// Pet Tem Home — camada de dados
//
// Uma única interface (window.PetAPI) para o site, a página de conta, o
// formulário de solicitação e o painel da loja, com dois "motores":
//
//  * supabase → banco online (quando supabaseUrl/supabaseAnonKey estão em
//                js/config.js). Pedidos feitos em qualquer aparelho chegam
//                no painel da loja em tempo real.
//  * demo     → tudo salvo no navegador (para apresentar sem configurar nada).
//
// Nos dois modos o banco só recebe dados CRIPTOGRAFADOS (js/crypto.js).

(function () {
  "use strict";

  var C = window.PetCrypto;
  var CFG = window.PET_CONFIG;

  var CONFIGURED = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var HAS_LIB = !!(window.supabase && window.supabase.createClient);
  var MODE = CONFIGURED ? (HAS_LIB ? "supabase" : "offline") : "demo";

  var STATUS_LABEL = { pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído" };
  var STATUS_ORDER = ["pendente", "em_andamento", "concluido"];
  var KINDS = ["Pedido de produtos", "Encomenda de produto", "Orçamento", "Dúvida ou outro assunto"];
  var PAYMENTS = ["Pix", "Cartão", "Dinheiro"];

  var CUSTOMER_KEY = "customer-enc-key";
  var STORE_KEY = "store-private-key-v2";

  // ================= utilitários =================
  function fail(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }
  function firstName(name) { return String(name || "").trim().split(/\s+/)[0] || "Cliente"; }
  function formatNumber(n) { return "#" + String(n).padStart(4, "0"); }
  function storeById(id) { return CFG.stores.filter(function (s) { return s.id === id; })[0]; }
  function iso() { return new Date().toISOString(); }
  function toTime(v) { return v ? new Date(v).getTime() : null; }
  function clean(s, max) { return String(s || "").trim().slice(0, max); }

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

  // ---------- avisos de mudança (entre abas e na própria aba) ----------
  var listeners = [];
  var channel = "BroadcastChannel" in window ? new BroadcastChannel("pettemhome") : null;
  function emit() { listeners.forEach(function (cb) { try { cb(); } catch (e) { /* ignora */ } }); }
  function notify() {
    if (channel) channel.postMessage("changed");
    setTimeout(emit, 0);
  }
  if (channel) channel.onmessage = emit;
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf("ptm") === 0) emit();
  });
  function onChange(cb) {
    listeners.push(cb);
    return function () { listeners = listeners.filter(function (x) { return x !== cb; }); };
  }

  function readLS(k, fallback) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function writeLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); notify(); }

  // ================= motor DEMO (navegador) =================
  var DK = {
    users: "ptm2_users", customers: "ptm2_customers", requests: "ptm2_requests",
    seq: "ptm2_seq", vault: "ptm2_vault", session: "ptm2_session", throttle: "ptm2_throttle"
  };

  var demo = {
    signUp: async function (email, password) {
      var users = readLS(DK.users, {});
      var idx = await C.emailIndex(email);
      if (users[idx]) throw fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");
      var salt = C.randomSalt();
      var keys = await C.deriveUserKeys(password, salt);
      var id = C.randomId("u_");
      users[idx] = { id: id, salt: salt, verifier: keys.verifier };
      writeLS(DK.users, users);
      writeLS(DK.session, { userId: id, at: Date.now() });
      return { userId: id, needsConfirmation: false };
    },
    signIn: async function (email, password) {
      var t = readLS(DK.throttle, { count: 0, until: 0 });
      if (Date.now() < t.until) {
        throw fail("THROTTLED", "Muitas tentativas. Aguarde " + Math.ceil((t.until - Date.now()) / 1000) + "s e tente de novo.");
      }
      var users = readLS(DK.users, {});
      var user = users[await C.emailIndex(email)];
      var keys = await C.deriveUserKeys(password || "", user ? user.salt : C.randomSalt());
      if (!user || !C.safeEqual(keys.verifier, user.verifier)) {
        t.count += 1;
        if (t.count >= 5) t.until = Date.now() + 30000 * (t.count - 4);
        localStorage.setItem(DK.throttle, JSON.stringify(t));
        throw fail("INVALID", "E-mail ou senha incorretos.");
      }
      localStorage.removeItem(DK.throttle);
      writeLS(DK.session, { userId: user.id, at: Date.now() });
      return user.id;
    },
    signOut: async function () { localStorage.removeItem(DK.session); notify(); },
    getUserId: async function () { var s = readLS(DK.session, null); return s ? s.userId : null; },
    getEmail: async function () { return null; },
    getCustomer: async function (uid) { return readLS(DK.customers, {})[uid] || null; },
    insertCustomer: async function (row) {
      var uid = await demo.getUserId();
      var all = readLS(DK.customers, {});
      all[uid] = Object.assign({ user_id: uid, created_at: iso(), updated_at: iso(), last_login_at: iso() }, row);
      writeLS(DK.customers, all);
    },
    updateCustomer: async function (uid, patch) {
      var all = readLS(DK.customers, {});
      if (!all[uid]) return;
      all[uid] = Object.assign(all[uid], patch, { updated_at: iso() });
      writeLS(DK.customers, all);
    },
    listCustomers: async function () {
      return Object.values(readLS(DK.customers, {})).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    },
    insertRequest: async function (row) {
      var seq = readLS(DK.seq, 0) + 1;
      localStorage.setItem(DK.seq, JSON.stringify(seq));
      var now = iso();
      var full = Object.assign({}, row, {
        id: C.randomId("r_"), number: seq, customer_id: await demo.getUserId(),
        status: "pendente", seen_by_store: false, created_at: now, updated_at: now, status_changed_at: now
      });
      var all = readLS(DK.requests, []);
      all.unshift(full);
      writeLS(DK.requests, all.slice(0, 500));
      return full;
    },
    listMyRequests: async function (uid) {
      return readLS(DK.requests, []).filter(function (r) { return r.customer_id === uid; });
    },
    listRequests: async function () { return readLS(DK.requests, []); },
    updateRequest: async function (id, patch) {
      var all = readLS(DK.requests, []);
      all.forEach(function (r) {
        if (r.id !== id) return;
        if (patch.status && patch.status !== r.status) r.status_changed_at = iso();
        Object.assign(r, patch, { updated_at: iso() });
      });
      writeLS(DK.requests, all);
    },
    getVault: async function () { return readLS(DK.vault, null); },
    insertVault: async function (row) { writeLS(DK.vault, row); },
    updateVault: async function (patch) { writeLS(DK.vault, Object.assign(readLS(DK.vault, {}), patch)); },
    setStaffCode: async function (code, keyForCode) {
      var v = readLS(DK.vault, null);
      if (!v) throw fail("MISSING", "O cofre ainda não foi criado.");
      if (!code) { v.code_verifier = null; v.code_salt = null; v.key_for_code = null; v.code_set_at = null; }
      else {
        var salt = C.randomSalt();
        v.code_salt = salt;
        v.code_verifier = (await C.deriveUserKeys(code, salt)).verifier;
        v.key_for_code = keyForCode;
        v.code_set_at = iso();
      }
      writeLS(DK.vault, v);
    },
    checkCode: async function (code) {
      var v = readLS(DK.vault, null);
      if (!v || !v.code_verifier) return false;
      var keys = await C.deriveUserKeys(code || "", v.code_salt);
      return C.safeEqual(keys.verifier, v.code_verifier);
    },
    rpcVault: async function (code) {
      if (!(await demo.checkCode(code))) return null;
      var v = readLS(DK.vault, null);
      return { public_jwk: v.public_jwk, key_for_code: v.key_for_code };
    },
    rpcRequests: async function (code) {
      if (!(await demo.checkCode(code))) throw fail("WRONG_CODE", "Código incorreto.");
      return demo.listRequests();
    },
    rpcCustomers: async function (code) {
      if (!(await demo.checkCode(code))) throw fail("WRONG_CODE", "Código incorreto.");
      return demo.listCustomers();
    },
    rpcSetStatus: async function (code, id, status) {
      if (!(await demo.checkCode(code))) throw fail("WRONG_CODE", "Código incorreto.");
      return demo.updateRequest(id, { status: status, seen_by_store: true });
    },
    rpcMarkSeen: async function (code, id) {
      if (!(await demo.checkCode(code))) throw fail("WRONG_CODE", "Código incorreto.");
      return demo.updateRequest(id, { seen_by_store: true });
    },
    getStorePublicKey: async function () { var v = readLS(DK.vault, null); return v ? v.public_jwk : null; },
    isStaff: async function () { return true; },
    subscribe: function (cb) { return onChange(cb); }
  };

  // ================= motor SUPABASE =================
  var sb = MODE === "supabase"
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  function sbError(error) {
    var msg = String((error && error.message) || "");
    if (/invalid login credentials/i.test(msg)) return fail("INVALID", "E-mail ou senha incorretos.");
    if (/email not confirmed/i.test(msg)) return fail("NOT_CONFIRMED", "Confirme seu e-mail pelo link que enviamos e depois entre.");
    if (/already registered|already been registered/i.test(msg)) return fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");
    if (/security purposes|rate limit|too many/i.test(msg)) return fail("THROTTLED", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.");
    if (/password/i.test(msg)) return fail("VALIDATION", "Senha fraca: use pelo menos 8 caracteres com letras e números.");
    if (/row-level security|permission denied/i.test(msg)) return fail("FORBIDDEN", "Você não tem permissão para esta ação.");
    if (/failed to fetch|network/i.test(msg)) return fail("OFFLINE", "Sem conexão com o sistema da loja. Verifique a internet e tente de novo.");
    return fail("SERVER", "Não foi possível concluir agora. Tente novamente em instantes.");
  }
  function must(res) {
    if (res.error) throw sbError(res.error);
    return res.data;
  }

  var remote = {
    signUp: async function (email, password) {
      var data = must(await sb.auth.signUp({
        email: email, password: password,
        options: { emailRedirectTo: window.location.origin + "/login" }
      }));
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");
      }
      return { userId: data.user && data.user.id, needsConfirmation: !data.session };
    },
    signIn: async function (email, password) {
      var data = must(await sb.auth.signInWithPassword({ email: email, password: password }));
      return data.user.id;
    },
    signOut: async function () { await sb.auth.signOut(); notify(); },
    getUserId: async function () {
      var s = (await sb.auth.getSession()).data.session;
      return s ? s.user.id : null;
    },
    getEmail: async function () {
      var s = (await sb.auth.getSession()).data.session;
      return s ? s.user.email : null;
    },
    getCustomer: async function (uid) {
      return must(await sb.from("customers").select("*").eq("user_id", uid).maybeSingle());
    },
    insertCustomer: async function (row) { must(await sb.from("customers").insert(row)); },
    updateCustomer: async function (uid, patch) { must(await sb.from("customers").update(patch).eq("user_id", uid)); },
    listCustomers: async function () {
      return must(await sb.from("customers").select("*").order("created_at", { ascending: false }).limit(1000));
    },
    insertRequest: async function (row) {
      return must(await sb.from("requests").insert(row).select("*").single());
    },
    listMyRequests: async function (uid) {
      return must(await sb.from("requests").select("*").eq("customer_id", uid).order("created_at", { ascending: false }).limit(100));
    },
    listRequests: async function () {
      return must(await sb.from("requests").select("*").order("created_at", { ascending: false }).limit(500));
    },
    updateRequest: async function (id, patch) { must(await sb.from("requests").update(patch).eq("id", id)); },
    getVault: async function () {
      return must(await sb.from("store_vault").select("*").eq("id", 1).maybeSingle());
    },
    insertVault: async function (row) { must(await sb.from("store_vault").insert(Object.assign({ id: 1 }, row))); },
    updateVault: async function (patch) { must(await sb.from("store_vault").update(patch).eq("id", 1)); },
    setStaffCode: async function (code, keyForCode) {
      must(await sb.rpc("set_staff_code", { p_code: code, p_key_for_code: keyForCode }));
    },
    rpcVault: async function (code) { return must(await sb.rpc("painel_vault", { p_code: code })); },
    rpcRequests: async function (code) { return must(await sb.rpc("painel_requests", { p_code: code })); },
    rpcCustomers: async function (code) { return must(await sb.rpc("painel_customers", { p_code: code })); },
    rpcSetStatus: async function (code, id, status) {
      must(await sb.rpc("painel_set_status", { p_code: code, p_id: id, p_status: status }));
    },
    rpcMarkSeen: async function (code, id) { must(await sb.rpc("painel_mark_seen", { p_code: code, p_id: id })); },
    getStorePublicKey: async function () { return must(await sb.rpc("store_public_key")); },
    isStaff: async function (uid) {
      return !!must(await sb.from("staff").select("user_id").eq("user_id", uid).maybeSingle());
    },
    subscribe: function (cb) {
      var ch = sb.channel("painel-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, function () { cb(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, function () { cb(); })
        .subscribe();
      var off = onChange(cb);
      return function () { sb.removeChannel(ch); off(); };
    }
  };

  var offline = new Proxy({}, {
    get: function () {
      return function () {
        return Promise.reject(fail("OFFLINE", "Sem conexão com o sistema da loja. Verifique a internet e recarregue a página."));
      };
    }
  });

  var A = MODE === "supabase" ? remote : MODE === "demo" ? demo : offline;

  // ================= chave pessoal do cliente =================
  async function getCustomerKey() { try { return (await C.vaultGet(CUSTOMER_KEY)) || null; } catch (e) { return null; } }
  async function setCustomerKey(k) { try { await C.vaultSet(CUSTOMER_KEY, k); } catch (e) { /* sem IndexedDB */ } }
  async function clearCustomerKey() { try { await C.vaultDelete(CUSTOMER_KEY); } catch (e) { /* ignora */ } }

  async function storePublicKey() {
    var pub = await A.getStorePublicKey();
    if (!pub) throw fail("NO_STORE_KEY", "A loja ainda está ativando o sistema de pedidos. Tente novamente mais tarde ou fale pelo WhatsApp.");
    return pub;
  }

  // cadastro aguardando confirmação de e-mail: guardado cifrado neste aparelho
  var PENDING = "ptm2_pending_profile";
  async function savePending(email, salt, box) {
    localStorage.setItem(PENDING, JSON.stringify({ idx: await C.emailIndex(email), salt: salt, box: box }));
  }
  async function takePending(email) {
    var p = readLS(PENDING, null);
    if (!p || p.idx !== await C.emailIndex(email)) return null;
    return p;
  }

  async function writeCustomer(profile, salt, encKey, pub, isUpdate, uid) {
    var row = {
      key_salt: salt,
      profile_for_customer: await C.encryptWithKey(encKey, profile),
      profile_for_store: await C.sealForStore(Object.assign({}, profile, { savedAt: Date.now() }), pub)
    };
    if (isUpdate) await A.updateCustomer(uid, row);
    else await A.insertCustomer(Object.assign(row, { last_login_at: iso() }));
  }

  // ================= clientes =================
  async function register(profile, password) {
    validateProfile(profile);
    validatePassword(password);
    var pub = await storePublicKey();
    var res = await A.signUp(profile.email, password);
    var salt = C.randomSalt();
    var keys = await C.deriveUserKeys(password, salt);
    if (res.needsConfirmation) {
      await savePending(profile.email, salt, await C.encryptWithKey(keys.encKey, profile));
      return { needsConfirmation: true };
    }
    await writeCustomer(profile, salt, keys.encKey, pub, false);
    await setCustomerKey(keys.encKey);
    notify();
    return { needsConfirmation: false };
  }

  async function login(email, password) {
    var uid = await A.signIn(String(email || "").trim(), password || "");
    var row = await A.getCustomer(uid);
    if (!row) {
      var pending = await takePending(email);
      if (pending) {
        var pk = await C.deriveUserKeys(password, pending.salt);
        var profile = await C.decryptWithKey(pk.encKey, pending.box);
        await writeCustomer(profile, pending.salt, pk.encKey, await storePublicKey(), false);
        localStorage.removeItem(PENDING);
        await setCustomerKey(pk.encKey);
        notify();
        return { profile: true };
      }
      notify();
      return { profile: false };
    }
    var keys = await C.deriveUserKeys(password, row.key_salt);
    try {
      await C.decryptWithKey(keys.encKey, row.profile_for_customer);
      await setCustomerKey(keys.encKey);
    } catch (e) {
      await clearCustomerKey();
      notify();
      return { profile: true, locked: true };
    }
    A.updateCustomer(uid, { last_login_at: iso() }).catch(function () {});
    notify();
    return { profile: true };
  }

  async function logout() {
    await clearCustomerKey();
    await A.signOut();
  }

  // ---------- esqueci a senha (só no modo online) ----------
  async function requestPasswordReset(email) {
    if (MODE !== "supabase") throw fail("DEMO", "A recuperação de senha por e-mail funciona quando o site estiver conectado ao Supabase.");
    must(await sb.auth.resetPasswordForEmail(String(email || "").trim(), { redirectTo: window.location.origin + "/login" }));
  }

  function isRecoveryLink() {
    return /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search);
  }

  async function updatePassword(password) {
    validatePassword(password);
    if (MODE !== "supabase") throw fail("DEMO", "Disponível apenas no modo online.");
    must(await sb.auth.updateUser({ password: password }));
    await clearCustomerKey();
    notify();
  }

  async function currentUser() {
    var uid = await A.getUserId();
    if (!uid) return null;
    var row = await A.getCustomer(uid);
    var key = await getCustomerKey();
    var profile = null;
    if (row && key) {
      try { profile = await C.decryptWithKey(key, row.profile_for_customer); } catch (e) { profile = null; }
    }
    return {
      id: uid,
      email: (profile && profile.email) || (await A.getEmail()),
      hasProfile: !!row,
      locked: !!row && !profile,
      profile: profile,
      key: key
    };
  }

  async function updateProfile(profile) {
    validateProfile(profile);
    var me = await currentUser();
    if (!me) throw fail("AUTH", "Sua sessão expirou. Entre novamente.");
    if (!me.key || !me.hasProfile) throw fail("LOCKED", "Entre novamente com sua senha para editar os dados.");
    var row = await A.getCustomer(me.id);
    await writeCustomer(profile, row.key_salt, me.key, await storePublicKey(), true, me.id);
    notify();
  }

  // Completa ou refaz o cadastro (primeiro acesso, ou após trocar a senha)
  async function saveProfileWithPassword(profile, password) {
    validateProfile(profile);
    var uid = await A.getUserId();
    if (!uid) throw fail("AUTH", "Sua sessão expirou. Entre novamente.");
    var salt = C.randomSalt();
    var keys = await C.deriveUserKeys(password, salt);
    var existing = await A.getCustomer(uid);
    await writeCustomer(profile, salt, keys.encKey, await storePublicKey(), !!existing, uid);
    await setCustomerKey(keys.encKey);
    notify();
  }

  // ================= solicitações (cliente) =================
  function normalize(row, data) {
    return {
      id: row.id,
      number: row.number,
      code: formatNumber(row.number),
      status: row.status,
      statusLabel: STATUS_LABEL[row.status] || row.status,
      seen: !!row.seen_by_store,
      kind: row.kind,
      storeId: row.store_id,
      delivery: row.delivery,
      customerId: row.customer_id,
      createdAt: toTime(row.created_at),
      statusChangedAt: toTime(row.status_changed_at),
      data: data
    };
  }

  async function createRequest(input) {
    var me = await currentUser();
    if (!me) throw fail("AUTH", "Entre na sua conta para enviar a solicitação.");
    if (!me.profile) throw fail("PROFILE", "Complete seu cadastro antes de enviar a solicitação.");

    var kind = KINDS.indexOf(input.kind) !== -1 ? input.kind : KINDS[0];
    var store = storeById(input.storeId);
    if (!store) throw fail("VALIDATION", "Escolha a loja que vai atender.");
    var delivery = input.delivery === "retirada" ? "retirada" : "entrega";
    var items = (input.items || []).slice(0, 50).map(function (i) {
      return { name: clean(i.name, 120), qty: Math.max(1, Math.min(99, Number(i.qty) || 1)), price: Number(i.price) || 0 };
    });
    var message = clean(input.message, 1000);
    if (!items.length && message.length < 5) {
      throw fail("VALIDATION", "Descreva o que você precisa ou adicione produtos da sacola.");
    }

    var data = {
      kind: kind,
      store: store.name + " – " + store.district,
      customer: { name: me.profile.name, phone: me.profile.phone, email: me.profile.email },
      delivery: { type: delivery, address: delivery === "entrega" ? me.profile.address : null },
      payment: PAYMENTS.indexOf(input.payment) !== -1 ? input.payment : PAYMENTS[0],
      items: items,
      total: items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
      message: message,
      contact: clean(input.contact, 40),
      sentAt: Date.now()
    };

    var pub = await storePublicKey();
    var row = await A.insertRequest({
      store_id: store.id,
      kind: kind,
      delivery: delivery,
      data_for_store: await C.sealForStore(data, pub),
      data_for_customer: await C.encryptWithKey(me.key, data)
    });
    notify();
    return normalize(row, data);
  }

  async function myRequests() {
    var me = await currentUser();
    if (!me) return [];
    var rows = await A.listMyRequests(me.id);
    return Promise.all(rows.map(async function (r) {
      var data = null;
      if (me.key) { try { data = await C.decryptWithKey(me.key, r.data_for_customer); } catch (e) { data = null; } }
      return normalize(r, data);
    }));
  }

  // ================= loja =================
  var storeKey = null;
  var openCache = {};
  var accessMode = null;          // "manager" (gestor) ou "code" (equipe)
  var staffCode = null;           // código digitado pela equipe, usado nas consultas
  var CODE_REMEMBER = "ptm2_panel_code";

  var PANEL_DEMO = "ptm2_panel";

  async function staffLogin(email, password) {
    if (MODE === "demo") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
        throw fail("VALIDATION", "Informe um e-mail. Na demonstração, qualquer e-mail e senha entram como gestor.");
      }
      localStorage.setItem(PANEL_DEMO, "1");
      accessMode = "manager";
      return;
    }
    var uid = await A.signIn(String(email || "").trim(), password || "");
    if (!(await A.isStaff(uid))) {
      await A.signOut();
      throw fail("NOT_STAFF", "Esta conta não tem acesso ao painel. O painel é exclusivo da equipe da loja.");
    }
    accessMode = "manager";
  }

  async function staffSession() {
    if (accessMode === "code") return { isStaff: true, code: true, manager: false, email: "Equipe (código)" };
    if (MODE === "demo") {
      return localStorage.getItem(PANEL_DEMO) === "1"
        ? { demo: true, isStaff: true, manager: true, email: "demonstração" }
        : null;
    }
    var uid = await A.getUserId();
    if (!uid) return null;
    return { userId: uid, email: await A.getEmail(), isStaff: await A.isStaff(uid), manager: true };
  }

  async function staffLogout() {
    var wasManager = accessMode === "manager";
    await vaultLock();
    localStorage.removeItem(PANEL_DEMO);
    if (MODE !== "demo" && wasManager) await A.signOut();
  }

  async function vaultStatus() {
    if (storeKey) return "unlocked";
    var vault = await A.getVault();
    if (!vault) return "missing";
    try {
      var remembered = await C.vaultGet(STORE_KEY);
      // só o gestor guarda a chave neste aparelho (a equipe guarda o código)
      if (remembered) { storeKey = remembered; accessMode = "manager"; return "unlocked"; }
    } catch (e) { /* sem IndexedDB */ }
    return "locked";
  }

  async function vaultCreate(passphrase, remember) {
    if (!passphrase || passphrase.length < 10) throw fail("VALIDATION", "A senha do cofre precisa ter pelo menos 10 caracteres.");
    if (await A.getVault()) throw fail("EXISTS", "O cofre da loja já foi criado. Use a senha do cofre para abrir.");
    var kp = await C.generateVaultKeyPair();
    var wrapped = await C.wrapPrivateKey(kp.pkcs8, passphrase);
    await A.insertVault({ public_jwk: kp.publicJwk, encrypted_private_key: wrapped });
    storeKey = await C.importPrivatePkcs8(kp.pkcs8);
    accessMode = "manager";
    if (remember) { try { await C.vaultSet(STORE_KEY, storeKey); } catch (e) { /* ignora */ } }
    notify();
  }

  async function vaultUnlock(passphrase, remember) {
    var vault = await A.getVault();
    if (!vault) throw fail("MISSING", "O cofre ainda não foi criado.");
    // Aceita a senha do cofre ou o código da equipe (as duas abrem a mesma
    // chave), para o gestor não ficar travado se esquecer a senha.
    storeKey = null;
    try { storeKey = await C.unwrapPrivateKey(vault.encrypted_private_key, passphrase || ""); } catch (e) { storeKey = null; }
    if (!storeKey && vault.key_for_code) {
      try { storeKey = await C.unwrapPrivateKey(vault.key_for_code, passphrase || ""); } catch (e) { storeKey = null; }
    }
    if (!storeKey) throw fail("WRONG_PASSPHRASE", "Senha do cofre (ou código da equipe) incorreta.");
    accessMode = "manager";
    if (remember) { try { await C.vaultSet(STORE_KEY, storeKey); } catch (e) { /* ignora */ } }
  }

  // ---------- acesso da equipe por código ----------
  async function codeUnlock(code, remember) {
    code = String(code || "").trim();
    if (!code) throw fail("VALIDATION", "Digite o código da equipe.");
    var vault = await A.rpcVault(code);
    if (!vault || !vault.key_for_code) throw fail("WRONG_CODE", "Código incorreto ou acesso por código desativado pelo gestor.");
    try {
      storeKey = await C.unwrapPrivateKey(vault.key_for_code, code);
    } catch (e) {
      throw fail("WRONG_CODE", "Código incorreto.");
    }
    staffCode = code;
    accessMode = "code";
    if (remember) localStorage.setItem(CODE_REMEMBER, code);
    else localStorage.removeItem(CODE_REMEMBER);
  }

  async function codeRemembered() {
    var code = localStorage.getItem(CODE_REMEMBER);
    if (!code) return false;
    try { await codeUnlock(code, true); return true; }
    catch (e) { localStorage.removeItem(CODE_REMEMBER); return false; }
  }

  // O gestor define, troca ou desliga o código. Precisa da senha do cofre para
  // gerar a cópia da chave que o código abre.
  async function setStaffCode(newCode, vaultPassphrase) {
    if (accessMode !== "manager") throw fail("FORBIDDEN", "Só o gestor pode definir o código da equipe.");
    var vault = await A.getVault();
    if (!vault) throw fail("MISSING", "O cofre ainda não foi criado.");
    if (!newCode) {
      await A.setStaffCode(null, null);
      notify();
      return;
    }
    newCode = String(newCode).trim();
    if (newCode.length < 8) throw fail("VALIDATION", "O código precisa ter pelo menos 8 caracteres.");
    var pkcs8;
    try {
      pkcs8 = await C.openVaultKey(vault.encrypted_private_key, vaultPassphrase || "");
    } catch (e) {
      throw fail("WRONG_PASSPHRASE", "Senha do cofre incorreta.");
    }
    await A.setStaffCode(newCode, await C.wrapPrivateKey(pkcs8, newCode));
    notify();
  }

  async function staffCodeInfo() {
    var vault = await A.getVault();
    if (!vault) return { enabled: false, setAt: null };
    return { enabled: !!(vault.code_hash || vault.code_verifier), setAt: toTime(vault.code_set_at) };
  }

  // Troca a senha do cofre mantendo a MESMA chave: o histórico continua legível
  async function changeVaultPassphrase(current, next) {
    if (accessMode !== "manager") throw fail("FORBIDDEN", "Só o gestor pode trocar a senha do cofre.");
    if (!next || next.length < 10) throw fail("VALIDATION", "A nova senha do cofre precisa ter pelo menos 10 caracteres.");
    var vault = await A.getVault();
    if (!vault) throw fail("MISSING", "O cofre ainda não foi criado.");
    // Aceita a senha atual do cofre OU o código da equipe: as duas abrem a
    // mesma chave, então o gestor não fica travado se esquecer a senha.
    var pkcs8 = null;
    try { pkcs8 = await C.openVaultKey(vault.encrypted_private_key, current || ""); } catch (e) { pkcs8 = null; }
    if (!pkcs8 && vault.key_for_code) {
      try { pkcs8 = await C.openVaultKey(vault.key_for_code, current || ""); } catch (e) { pkcs8 = null; }
    }
    if (!pkcs8) throw fail("WRONG_PASSPHRASE", "Senha atual do cofre (ou código da equipe) incorreta.");
    await A.updateVault({ encrypted_private_key: await C.wrapPrivateKey(pkcs8, next) });
    notify();
  }

  async function vaultLock() {
    storeKey = null;
    openCache = {};
    accessMode = null;
    staffCode = null;
    localStorage.removeItem(CODE_REMEMBER);
    try { await C.vaultDelete(STORE_KEY); } catch (e) { /* ignora */ }
  }

  async function openForStore(cacheKey, box) {
    if (!storeKey) throw fail("LOCKED", "Abra o cofre da loja para ver os dados.");
    if (openCache[cacheKey] !== undefined) return openCache[cacheKey];
    try { openCache[cacheKey] = await C.openSealed(box, storeKey); }
    catch (e) { openCache[cacheKey] = null; }
    return openCache[cacheKey];
  }

  async function listRequests() {
    var rows = accessMode === "code" ? await A.rpcRequests(staffCode) : await A.listRequests();
    return Promise.all(rows.map(async function (r) {
      return normalize(r, await openForStore("r:" + r.id, r.data_for_store));
    }));
  }

  async function setStatus(id, status) {
    if (STATUS_ORDER.indexOf(status) === -1) throw fail("VALIDATION", "Status inválido.");
    if (accessMode === "code") await A.rpcSetStatus(staffCode, id, status);
    else await A.updateRequest(id, { status: status, seen_by_store: true });
    notify();
  }

  async function markSeen(id) {
    if (accessMode === "code") await A.rpcMarkSeen(staffCode, id);
    else await A.updateRequest(id, { seen_by_store: true });
    notify();
  }

  async function listCustomers() {
    var byCode = accessMode === "code";
    var rows = byCode ? await A.rpcCustomers(staffCode) : await A.listCustomers();
    var reqs = byCode ? await A.rpcRequests(staffCode) : await A.listRequests();
    var count = {};
    reqs.forEach(function (r) { count[r.customer_id] = (count[r.customer_id] || 0) + 1; });
    return Promise.all(rows.map(async function (c) {
      return {
        userId: c.user_id,
        createdAt: toTime(c.created_at),
        lastLoginAt: toTime(c.last_login_at),
        requests: count[c.user_id] || 0,
        profile: await openForStore("c:" + c.user_id + ":" + (c.updated_at || ""), c.profile_for_store)
      };
    }));
  }

  function subscribe(cb) {
    // No acesso por código não existe sessão no banco, então o tempo real não
    // se aplica: o painel continua consultando a cada 20 segundos.
    if (accessMode === "code" && MODE === "supabase") return onChange(cb);
    return A.subscribe(cb);
  }

  function clearDemoData() {
    if (MODE !== "demo") return;
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf("ptm2_") === 0 || k.indexOf("ptm_db_") === 0 || k === "ptm_session" || k === "ptm_store_pubkey" || k === "ptm_panel_pubkey") {
        localStorage.removeItem(k);
      }
    });
    storeKey = null;
    openCache = {};
    clearCustomerKey();
    try { C.vaultDelete(STORE_KEY); } catch (e) { /* ignora */ }
    notify();
  }

  // ================= sacola =================
  var cart = {
    get: function () { return readLS("ptm_cart", []); },
    set: function (items) { writeLS("ptm_cart", items); },
    clear: function () { localStorage.removeItem("ptm_cart"); notify(); }
  };

  window.PetAPI = {
    mode: MODE,
    STATUS_LABEL: STATUS_LABEL,
    STATUS_ORDER: STATUS_ORDER,
    KINDS: KINDS,
    PAYMENTS: PAYMENTS,
    formatNumber: formatNumber,
    firstName: firstName,
    storeById: storeById,
    // clientes
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    updateProfile: updateProfile,
    saveProfileWithPassword: saveProfileWithPassword,
    requestPasswordReset: requestPasswordReset,
    isRecoveryLink: isRecoveryLink,
    updatePassword: updatePassword,
    createRequest: createRequest,
    myRequests: myRequests,
    // loja
    staffLogin: staffLogin,
    staffSession: staffSession,
    staffLogout: staffLogout,
    vaultStatus: vaultStatus,
    vaultCreate: vaultCreate,
    vaultUnlock: vaultUnlock,
    vaultLock: vaultLock,
    codeUnlock: codeUnlock,
    codeRemembered: codeRemembered,
    setStaffCode: setStaffCode,
    staffCodeInfo: staffCodeInfo,
    changeVaultPassphrase: changeVaultPassphrase,
    accessKind: function () { return accessMode; },
    listRequests: listRequests,
    setStatus: setStatus,
    markSeen: markSeen,
    listCustomers: listCustomers,
    subscribe: subscribe,
    clearDemoData: clearDemoData,
    // geral
    onChange: onChange,
    cart: cart
  };
})();
