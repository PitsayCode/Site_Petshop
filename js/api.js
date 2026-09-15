// Pet Tem Home — camada de dados (backend simulado)
//
// Hoje os dados ficam no localStorage do navegador para a demonstração
// funcionar sem servidor. Todas as funções já são assíncronas e recebem /
// devolvem apenas blocos cifrados: para ir para produção, basta trocar o
// conteúdo de db.read/db.write (e as listas) por chamadas fetch() a uma API
// real — o servidor continua sem conseguir ler nada sensível.

(function () {
  "use strict";

  var C = window.PetCrypto;
  var CFG = window.PET_CONFIG;

  var KEYS = {
    users: "ptm_db_users",
    orders: "ptm_db_orders",
    events: "ptm_db_events",
    session: "ptm_session",
    storePub: "ptm_store_pubkey",
    cart: "ptm_cart",
    throttle: "ptm_login_throttle"
  };
  var SESSION_KEY_NAME = "session-enc-key";

  var db = {
    read: function (k, fallback) {
      try {
        var raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    write: function (k, v) {
      localStorage.setItem(k, JSON.stringify(v));
      notify();
    }
  };

  // ---------- avisos entre abas (site <-> painel) ----------
  var channel = "BroadcastChannel" in window ? new BroadcastChannel("pettemhome") : null;
  var listeners = [];
  function notify() {
    if (channel) channel.postMessage("changed");
    setTimeout(emit, 0); // a própria aba também precisa atualizar
  }
  function onChange(cb) {
    listeners.push(cb);
  }
  function emit() { listeners.forEach(function (cb) { cb(); }); }
  if (channel) channel.onmessage = emit;
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf("ptm_") === 0) emit();
  });

  function fail(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || "Cliente";
  }

  // ---------- chave pública do painel ----------
  function getStorePublicKey() {
    return CFG.storePublicKeyJwk || db.read(KEYS.storePub, null);
  }
  function publishStorePublicKey(jwk) {
    db.write(KEYS.storePub, jwk);
  }

  async function pushEvent(payload) {
    var pub = getStorePublicKey();
    if (!pub) return;
    var events = db.read(KEYS.events, []);
    events.unshift({ id: C.randomId("ev_"), at: Date.now(), box: await C.sealForStore(payload, pub) });
    db.write(KEYS.events, events.slice(0, 200));
  }

  // ---------- sessão ----------
  async function startSession(user, encKey) {
    await C.vaultSet(SESSION_KEY_NAME, encKey);
    db.write(KEYS.session, { userId: user.id, idx: user.idx, at: Date.now() });
  }

  async function logout() {
    localStorage.removeItem(KEYS.session);
    try { await C.vaultDelete(SESSION_KEY_NAME); } catch (e) { /* cofre indisponível */ }
    notify();
  }

  async function currentUser() {
    var session = db.read(KEYS.session, null);
    if (!session) return null;
    var user = db.read(KEYS.users, {})[session.idx];
    var key = null;
    try { key = await C.vaultGet(SESSION_KEY_NAME); } catch (e) { key = null; }
    if (!user || !key) { await logout(); return null; }
    try {
      var profile = await C.decryptWithKey(key, user.profile);
      return { id: user.id, profile: profile, key: key, idx: session.idx };
    } catch (e) {
      await logout();
      return null;
    }
  }

  // ---------- cadastro e login ----------
  function validateProfile(p) {
    if (!p.name || p.name.trim().length < 2) throw fail("VALIDATION", "Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "")) throw fail("VALIDATION", "Informe um e-mail válido.");
    if (String(p.phone || "").replace(/\D/g, "").length < 10) throw fail("VALIDATION", "Informe um telefone com DDD.");
    var a = p.address || {};
    if (!a.street || !a.number || !a.district) throw fail("VALIDATION", "Preencha rua, número e bairro para a entrega.");
  }

  function validatePassword(pw) {
    if (!pw || pw.length < 8) throw fail("VALIDATION", "A senha precisa ter pelo menos 8 caracteres.");
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw fail("VALIDATION", "Use letras e números na senha.");
  }

  async function register(profile, password) {
    validateProfile(profile);
    validatePassword(password);
    var users = db.read(KEYS.users, {});
    var idx = await C.emailIndex(profile.email);
    if (users[idx]) throw fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");

    var salt = C.randomSalt();
    var keys = await C.deriveUserKeys(password, salt);
    var user = {
      id: C.randomId("u_"),
      idx: idx,
      salt: salt,
      verifier: keys.verifier,
      profile: await C.encryptWithKey(keys.encKey, profile),
      createdAt: Date.now()
    };
    users[idx] = user;
    db.write(KEYS.users, users);
    await startSession(user, keys.encKey);
    await pushEvent({ type: "signup", name: firstName(profile.name), at: Date.now() });
  }

  async function login(email, password) {
    var t = db.read(KEYS.throttle, { count: 0, until: 0 });
    if (Date.now() < t.until) {
      var secs = Math.ceil((t.until - Date.now()) / 1000);
      throw fail("THROTTLED", "Muitas tentativas. Aguarde " + secs + "s e tente de novo.");
    }
    var users = db.read(KEYS.users, {});
    var idx = await C.emailIndex(email);
    var user = users[idx];
    // Deriva a chave mesmo sem usuário para não revelar quais e-mails existem
    var keys = await C.deriveUserKeys(password || "", user ? user.salt : C.randomSalt());

    if (!user || !C.safeEqual(keys.verifier, user.verifier)) {
      t.count += 1;
      if (t.count >= 5) { t.until = Date.now() + 30000 * (t.count - 4); }
      localStorage.setItem(KEYS.throttle, JSON.stringify(t));
      throw fail("INVALID", "E-mail ou senha incorretos.");
    }
    localStorage.removeItem(KEYS.throttle);
    await startSession(user, keys.encKey);
    var profile = await C.decryptWithKey(keys.encKey, user.profile);
    await pushEvent({ type: "login", name: firstName(profile.name), at: Date.now() });
  }

  async function updateProfile(profile) {
    validateProfile(profile);
    var me = await currentUser();
    if (!me) throw fail("AUTH", "Sua sessão expirou. Entre novamente.");
    var users = db.read(KEYS.users, {});
    users[me.idx].profile = await C.encryptWithKey(me.key, profile);
    db.write(KEYS.users, users);
  }

  // ---------- pedidos / comandas ----------
  function newOrderCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var bytes = window.crypto.getRandomValues(new Uint8Array(5));
    return "PTH-" + Array.from(bytes).map(function (b) { return chars[b % chars.length]; }).join("");
  }

  async function placeOrder(order) {
    var me = await currentUser();
    if (!me) throw fail("AUTH", "Entre na sua conta para finalizar o pedido.");
    if (!order.items || !order.items.length) throw fail("VALIDATION", "Sua sacola está vazia.");
    var pub = getStorePublicKey();
    if (!pub) throw fail("NO_STORE_KEY", "O painel da loja ainda não está ativo. Abra painel.html uma vez para ativá-lo.");

    var store = CFG.stores.filter(function (s) { return s.id === order.storeId; })[0] || CFG.stores[0];
    var total = order.items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
    var createdAt = Date.now();
    var code = newOrderCode();

    var comanda = {
      code: code,
      createdAt: createdAt,
      store: store.name + " – " + store.district,
      customer: { name: me.profile.name, phone: me.profile.phone, email: me.profile.email },
      delivery: {
        type: order.deliveryType,
        address: order.deliveryType === "entrega" ? me.profile.address : null
      },
      items: order.items.map(function (i) { return { name: i.name, qty: i.qty, price: i.price }; }),
      total: total,
      payment: order.payment,
      notes: String(order.notes || "").slice(0, 400)
    };

    var orders = db.read(KEYS.orders, []);
    orders.unshift({
      id: C.randomId("o_"),
      userId: me.id,
      storeId: store.id,
      status: "novo",
      createdAt: createdAt,
      updatedAt: createdAt,
      forStore: await C.sealForStore(comanda, pub),
      forCustomer: await C.encryptWithKey(me.key, comanda)
    });
    db.write(KEYS.orders, orders);
    return comanda;
  }

  async function myOrders() {
    var me = await currentUser();
    if (!me) return [];
    var mine = db.read(KEYS.orders, []).filter(function (o) { return o.userId === me.id; });
    return Promise.all(mine.map(async function (o) {
      var data = await C.decryptWithKey(me.key, o.forCustomer);
      return Object.assign(data, { status: o.status, updatedAt: o.updatedAt });
    }));
  }

  // Usado pelo painel: devolve os registros ainda cifrados
  function rawOrders() { return db.read(KEYS.orders, []); }
  function rawEvents() { return db.read(KEYS.events, []); }

  function setOrderStatus(id, status) {
    var orders = db.read(KEYS.orders, []);
    orders.forEach(function (o) {
      if (o.id === id) { o.status = status; o.updatedAt = Date.now(); }
    });
    db.write(KEYS.orders, orders);
  }

  function clearDemoData() {
    [KEYS.users, KEYS.orders, KEYS.events, KEYS.session, KEYS.cart, KEYS.throttle].forEach(function (k) {
      localStorage.removeItem(k);
    });
    notify();
  }

  // ---------- sacola ----------
  var cart = {
    get: function () { return db.read(KEYS.cart, []); },
    set: function (items) { db.write(KEYS.cart, items); },
    clear: function () { localStorage.removeItem(KEYS.cart); notify(); }
  };

  window.PetAPI = {
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    updateProfile: updateProfile,
    placeOrder: placeOrder,
    myOrders: myOrders,
    rawOrders: rawOrders,
    rawEvents: rawEvents,
    setOrderStatus: setOrderStatus,
    getStorePublicKey: getStorePublicKey,
    publishStorePublicKey: publishStorePublicKey,
    clearDemoData: clearDemoData,
    firstName: firstName,
    onChange: onChange,
    cart: cart
  };
})();
