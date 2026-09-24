// Bosque Pet — camada de dados
//
// Uma única interface (window.PetAPI) para o site, a conta do cliente, o
// formulário de solicitação e o painel da loja, com dois "motores":
//
//  * supabase → banco online (quando supabaseUrl/supabaseKey estão em
//                js/config.js). Solicitações feitas em qualquer aparelho
//                aparecem no painel da loja.
//  * demo     → tudo salvo no navegador (para apresentar sem configurar nada).
//
// Quem acessa o quê:
//  * Cliente    : e-mail e senha. Vê e edita só o que é dele.
//  * Gestor     : e-mail e senha de uma conta marcada como equipe (tabela
//                 staff). Vê o painel inteiro e define o código da equipe.
//  * Funcionário: entra no painel digitando só o código definido pelo gestor.

(function () {
  "use strict";

  var C = window.PetCrypto;
  var CFG = window.PET_CONFIG;

  // aceita o nome novo (chave publicável) e o antigo (anon public)
  var SUPABASE_KEY = CFG.supabaseKey || CFG.supabaseAnonKey || "";
  var CONFIGURED = !!(CFG.supabaseUrl && SUPABASE_KEY);
  var HAS_LIB = !!(window.supabase && window.supabase.createClient);
  var MODE = CONFIGURED ? (HAS_LIB ? "supabase" : "offline") : "demo";

  var STATUS_LABEL = { pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído" };
  var STATUS_ORDER = ["pendente", "em_andamento", "concluido"];
  var KINDS = ["Pedido de produtos", "Encomenda de produto", "Orçamento", "Dúvida ou outro assunto"];
  var PAYMENTS = ["Pix", "Cartão", "Dinheiro"];
  var CODE_REMEMBER = "bp_panel_code";
  var PANEL_DEMO = "bp_panel_demo";
  var PENDING = "bp_pending_profile";

  var accessMode = null;   // "manager" (gestor logado) ou "code" (equipe)
  var staffCode = null;    // código digitado pela equipe

  // ================= utilitários =================
  function fail(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }
  function firstName(name) { return String(name || "").trim().split(/\s+/)[0] || "Cliente"; }
  function formatNumber(n) { return "#" + String(n).padStart(4, "0"); }

  // Só estes e-mails entram como gestor (lista em js/config.js).
  // Lista vazia = qualquer conta marcada como equipe no banco pode entrar.
  function managerAllowed(email) {
    var list = (CFG.managerEmails || []).map(function (e) { return String(e).trim().toLowerCase(); });
    if (!list.length) return true;
    return list.indexOf(String(email || "").trim().toLowerCase()) !== -1;
  }
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
  var channel = "BroadcastChannel" in window ? new BroadcastChannel("bosquepet") : null;
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

  // ================= motor DEMO (tudo no navegador) =================
  var DK = {
    users: "bp_users", customers: "bp_customers", requests: "bp_requests",
    seq: "bp_seq", access: "bp_access", session: "bp_session", throttle: "bp_throttle"
  };

  var demo = {
    signUp: async function (email, password) {
      var users = readLS(DK.users, {});
      var idx = await C.emailIndex(email);
      if (users[idx]) throw fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");
      var salt = C.randomSalt();
      var id = C.randomId("u_");
      users[idx] = { id: id, salt: salt, verifier: await C.passwordHash(password, salt), email: email };
      writeLS(DK.users, users);
      writeLS(DK.session, { userId: id, email: email, at: Date.now() });
      return { userId: id, needsConfirmation: false };
    },
    signIn: async function (email, password) {
      var t = readLS(DK.throttle, { count: 0, until: 0 });
      if (Date.now() < t.until) {
        throw fail("THROTTLED", "Muitas tentativas. Aguarde " + Math.ceil((t.until - Date.now()) / 1000) + "s e tente de novo.");
      }
      var users = readLS(DK.users, {});
      var user = users[await C.emailIndex(email)];
      var hash = await C.passwordHash(password || "", user ? user.salt : C.randomSalt());
      if (!user || !C.safeEqual(hash, user.verifier)) {
        t.count += 1;
        if (t.count >= 5) t.until = Date.now() + 30000 * (t.count - 4);
        localStorage.setItem(DK.throttle, JSON.stringify(t));
        throw fail("INVALID", "E-mail ou senha incorretos.");
      }
      localStorage.removeItem(DK.throttle);
      writeLS(DK.session, { userId: user.id, email: user.email, at: Date.now() });
      return user.id;
    },
    signOut: async function () { localStorage.removeItem(DK.session); notify(); },
    getUserId: async function () { var s = readLS(DK.session, null); return s ? s.userId : null; },
    getEmail: async function () { var s = readLS(DK.session, null); return s ? s.email : null; },
    updatePassword: async function (password) {
      var s = readLS(DK.session, null);
      if (!s) throw fail("AUTH", "Entre na sua conta primeiro.");
      var users = readLS(DK.users, {});
      var idx = await C.emailIndex(s.email);
      if (!users[idx]) throw fail("AUTH", "Conta não encontrada.");
      var salt = C.randomSalt();
      users[idx].salt = salt;
      users[idx].verifier = await C.passwordHash(password, salt);
      writeLS(DK.users, users);
    },
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
    isStaff: async function () { return localStorage.getItem(PANEL_DEMO) === "1"; },
    setStaffCode: async function (code) {
      var access = readLS(DK.access, {});
      if (!code) {
        access.code_verifier = null; access.code_salt = null; access.code_set_at = null;
      } else {
        var salt = C.randomSalt();
        access.code_salt = salt;
        access.code_verifier = await C.passwordHash(code, salt);
        access.code_set_at = iso();
      }
      writeLS(DK.access, access);
    },
    staffCodeStatus: async function () {
      var access = readLS(DK.access, {});
      return { enabled: !!access.code_verifier, set_at: access.code_set_at || null };
    },
    checkCode: async function (code) {
      var access = readLS(DK.access, {});
      if (!access.code_verifier) return false;
      return C.safeEqual(await C.passwordHash(code || "", access.code_salt), access.code_verifier);
    },
    rpcEnter: async function (code) { return demo.checkCode(code); },
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
    subscribe: function (cb) { return onChange(cb); }
  };

  // ================= motor SUPABASE =================
  var sb = MODE === "supabase"
    ? window.supabase.createClient(CFG.supabaseUrl, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  function sbError(error) {
    var msg = String((error && error.message) || "");
    if (/invalid login credentials/i.test(msg)) return fail("INVALID", "E-mail ou senha incorretos.");
    if (/email not confirmed/i.test(msg)) return fail("NOT_CONFIRMED", "Confirme seu e-mail pelo link que enviamos e depois entre.");
    if (/already registered|already been registered/i.test(msg)) return fail("EXISTS", "Já existe uma conta com este e-mail. Tente entrar.");
    if (/security purposes|rate limit|too many|muitas tentativas/i.test(msg)) return fail("THROTTLED", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.");
    if (/código/i.test(msg)) return fail("WRONG_CODE", msg);
    if (/password/i.test(msg)) return fail("VALIDATION", "Senha fraca: use pelo menos 8 caracteres com letras e números.");
    if (/row-level security|permission denied|apenas o gestor/i.test(msg)) return fail("FORBIDDEN", "Você não tem permissão para esta ação.");
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
    updatePassword: async function (password) { must(await sb.auth.updateUser({ password: password })); },
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
    isStaff: async function (uid) {
      return !!must(await sb.from("staff").select("user_id").eq("user_id", uid).maybeSingle());
    },
    setStaffCode: async function (code) { must(await sb.rpc("set_staff_code", { p_code: code })); },
    staffCodeStatus: async function () { return must(await sb.rpc("staff_code_status")); },
    rpcEnter: async function (code) { return must(await sb.rpc("painel_entrar", { p_code: code })); },
    rpcRequests: async function (code) { return must(await sb.rpc("painel_requests", { p_code: code })); },
    rpcCustomers: async function (code) { return must(await sb.rpc("painel_customers", { p_code: code })); },
    rpcSetStatus: async function (code, id, status) {
      must(await sb.rpc("painel_set_status", { p_code: code, p_id: id, p_status: status }));
    },
    rpcMarkSeen: async function (code, id) { must(await sb.rpc("painel_mark_seen", { p_code: code, p_id: id })); },
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

  // ================= clientes =================
  function profileFromRow(row) {
    if (!row) return null;
    return { name: row.name, email: row.email, phone: row.phone, address: row.address || {} };
  }
  function rowFromProfile(p) {
    return {
      name: clean(p.name, 120),
      email: clean(p.email, 160).toLowerCase(),
      phone: clean(p.phone, 40),
      address: p.address || {}
    };
  }

  async function register(profile, password) {
    validateProfile(profile);
    validatePassword(password);
    var res = await A.signUp(profile.email, password);
    if (res.needsConfirmation) {
      localStorage.setItem(PENDING, JSON.stringify(profile));
      return { needsConfirmation: true };
    }
    await A.insertCustomer(Object.assign(rowFromProfile(profile), { last_login_at: iso() }));
    notify();
    return { needsConfirmation: false };
  }

  async function login(email, password) {
    var uid = await A.signIn(String(email || "").trim(), password || "");
    var row = await A.getCustomer(uid);
    if (!row) {
      var pending = readLS(PENDING, null);
      if (pending && String(pending.email || "").toLowerCase() === String(email).trim().toLowerCase()) {
        await A.insertCustomer(Object.assign(rowFromProfile(pending), { last_login_at: iso() }));
        localStorage.removeItem(PENDING);
        notify();
        return { profile: true };
      }
      notify();
      return { profile: false };
    }
    A.updateCustomer(uid, { last_login_at: iso() }).catch(function () {});
    notify();
    return { profile: true };
  }

  async function logout() { await A.signOut(); }

  async function currentUser() {
    var uid = await A.getUserId();
    if (!uid) return null;
    var row = await A.getCustomer(uid);
    return {
      id: uid,
      email: (row && row.email) || (await A.getEmail()),
      hasProfile: !!row,
      profile: profileFromRow(row)
    };
  }

  async function saveProfile(profile) {
    validateProfile(profile);
    var uid = await A.getUserId();
    if (!uid) throw fail("AUTH", "Sua sessão expirou. Entre novamente.");
    var existing = await A.getCustomer(uid);
    if (existing) await A.updateCustomer(uid, rowFromProfile(profile));
    else await A.insertCustomer(Object.assign(rowFromProfile(profile), { last_login_at: iso() }));
    notify();
  }

  // ---------- senha ----------
  async function requestPasswordReset(email) {
    if (MODE !== "supabase") throw fail("DEMO", "A recuperação por e-mail funciona quando o site estiver conectado ao Supabase.");
    must(await sb.auth.resetPasswordForEmail(String(email || "").trim(), { redirectTo: window.location.origin + "/login" }));
  }
  function isRecoveryLink() {
    return /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search);
  }
  async function updatePassword(password) {
    validatePassword(password);
    await A.updatePassword(password);
    notify();
  }

  // ================= solicitações =================
  function normalize(row) {
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
      payment: row.payment,
      contact: row.contact,
      items: row.items || [],
      message: row.message || "",
      total: Number(row.total) || 0,
      snapshot: row.snapshot || {},
      customerId: row.customer_id,
      createdAt: toTime(row.created_at),
      statusChangedAt: toTime(row.status_changed_at)
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

    var row = await A.insertRequest({
      store_id: store.id,
      kind: kind,
      delivery: delivery,
      payment: PAYMENTS.indexOf(input.payment) !== -1 ? input.payment : PAYMENTS[0],
      contact: clean(input.contact, 40),
      items: items,
      message: message,
      total: items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
      snapshot: {
        store: store.name + " – " + store.district,
        customer: { name: me.profile.name, phone: me.profile.phone, email: me.profile.email },
        address: delivery === "entrega" ? me.profile.address : null
      }
    });
    notify();
    return normalize(row);
  }

  async function myRequests() {
    var uid = await A.getUserId();
    if (!uid) return [];
    return (await A.listMyRequests(uid)).map(normalize);
  }

  // ================= painel da loja =================
  async function staffLogin(email, password) {
    if (!managerAllowed(email)) {
      throw fail("NOT_STAFF", "Este e-mail não tem acesso ao painel. Entre com o e-mail do gestor da loja.");
    }
    if (MODE === "demo") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
        throw fail("VALIDATION", "Informe um e-mail. Na demonstração, qualquer e-mail e senha entram como gestor.");
      }
      localStorage.setItem(PANEL_DEMO, "1");
      localStorage.setItem(PANEL_DEMO + "_email", String(email).trim().toLowerCase());
      accessMode = "manager";
      return;
    }
    var uid = await A.signIn(String(email || "").trim(), password || "");
    if (!(await A.isStaff(uid))) {
      await A.signOut();
      throw fail("NOT_STAFF", "Esta conta não tem acesso ao painel. O painel é da equipe da loja.");
    }
    accessMode = "manager";
  }

  async function staffSession() {
    if (accessMode === "code") return { isStaff: true, code: true, manager: false, email: "Equipe (código)" };
    if (MODE === "demo") {
      var demoEmail = localStorage.getItem(PANEL_DEMO + "_email") || "";
      if (localStorage.getItem(PANEL_DEMO) !== "1" || !managerAllowed(demoEmail)) return null;
      accessMode = "manager";
      return { demo: true, isStaff: true, manager: true, email: demoEmail || "demonstração" };
    }
    var uid = await A.getUserId();
    if (!uid) return null;
    var email = await A.getEmail();
    // além de estar na tabela staff, o e-mail precisa estar na lista do config
    var staff = managerAllowed(email) && (await A.isStaff(uid));
    if (staff) accessMode = "manager";
    return { userId: uid, email: email, isStaff: staff, manager: staff };
  }

  async function staffLogout() {
    var wasManager = accessMode === "manager";
    accessMode = null;
    staffCode = null;
    localStorage.removeItem(CODE_REMEMBER);
    localStorage.removeItem(PANEL_DEMO);
    localStorage.removeItem(PANEL_DEMO + "_email");
    if (MODE !== "demo" && wasManager) await A.signOut();
    notify();
  }

  // ---------- acesso da equipe por código ----------
  async function codeEnter(code, remember) {
    if (MODE === "demo") await DEMO_READY;   // espera os dados de exemplo
    code = String(code || "").trim();
    if (!code) throw fail("VALIDATION", "Digite o código da equipe.");
    var ok = await A.rpcEnter(code);
    if (!ok) throw fail("WRONG_CODE", "Código incorreto ou acesso por código desativado pelo gestor.");
    staffCode = code;
    accessMode = "code";
    if (remember) localStorage.setItem(CODE_REMEMBER, code);
    else localStorage.removeItem(CODE_REMEMBER);
  }

  async function codeRemembered() {
    var code = localStorage.getItem(CODE_REMEMBER);
    if (!code) return false;
    try { await codeEnter(code, true); return true; }
    catch (e) { localStorage.removeItem(CODE_REMEMBER); return false; }
  }

  async function setStaffCode(newCode) {
    if (accessMode !== "manager") throw fail("FORBIDDEN", "Só o gestor pode definir o código da equipe.");
    if (newCode) {
      newCode = String(newCode).trim();
      if (newCode.length < 6) throw fail("VALIDATION", "O código precisa ter pelo menos 6 caracteres.");
    }
    await A.setStaffCode(newCode || null);
    notify();
  }

  async function staffCodeInfo() {
    var status = await A.staffCodeStatus();
    return { enabled: !!(status && status.enabled), setAt: toTime(status && status.set_at) };
  }

  // ---------- dados do painel ----------
  async function listRequests() {
    var rows = accessMode === "code" ? await A.rpcRequests(staffCode) : await A.listRequests();
    return rows.map(normalize);
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
    return rows.map(function (c) {
      return {
        userId: c.user_id,
        profile: profileFromRow(c),
        createdAt: toTime(c.created_at),
        lastLoginAt: toTime(c.last_login_at),
        requests: count[c.user_id] || 0
      };
    });
  }

  function subscribe(cb) {
    // No acesso por código não há sessão no banco: o painel continua
    // consultando a cada 20 segundos (o próprio painel cuida disso).
    if (accessMode === "code" && MODE === "supabase") return onChange(cb);
    return A.subscribe(cb);
  }

  function clearDemoData() {
    if (MODE !== "demo") return;
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf("bp_") === 0 || k.indexOf("ptm2_") === 0 || k.indexOf("ptm_db_") === 0) localStorage.removeItem(k);
    });
    accessMode = null;
    staffCode = null;
    notify();
  }

  // ================= sacola =================
  var cart = {
    get: function () { return readLS("ptm_cart", []); },
    set: function (items) { writeLS("ptm_cart", items); },
    clear: function () { localStorage.removeItem("ptm_cart"); notify(); }
  };


  // ================= dados de exemplo (só no MODO DEMONSTRAÇÃO) =================
  // Assim o painel e o catálogo abrem com conteúdo, sem ninguém precisar cadastrar nada.
  var DEMO_SEED = "bp_seeded";

  async function seedDemo() {
    if (MODE !== "demo" || localStorage.getItem(DEMO_SEED)) return;
    localStorage.setItem(DEMO_SEED, "1");

    var clientes = [
      {
        user_id: "u_demo_1", name: "Jéssica Martins", email: "jessica@exemplo.com", phone: "(11) 98888-1122",
        address: { street: "Rua das Acácias", number: "120", complement: "ap. 41", district: "Vila Madalena", city: "São Paulo – SP", zip: "05435-000" }
      },
      {
        user_id: "u_demo_2", name: "Carlos Ribeiro", email: "carlos@exemplo.com", phone: "(11) 97777-3344",
        address: { street: "Av. Braz Leme", number: "980", complement: "", district: "Santana", city: "São Paulo – SP", zip: "02022-010" }
      }
    ];
    var pessoas = {};
    clientes.forEach(function (c) {
      pessoas[c.user_id] = Object.assign({ created_at: iso(), updated_at: iso(), last_login_at: iso() }, c);
    });
    writeLS(DK.customers, pessoas);

    var agora = Date.now();
    var exemplos = [
      { n: 1, uid: "u_demo_1", status: "pendente", seen: false, min: 14, loja: 0, delivery: "entrega",
        items: [{ name: "Ração Cães Adultos 15 kg", qty: 1, price: 189.9 }, { name: "Petisco Bifinho 500 g", qty: 2, price: 23.9 }] },
      { n: 2, uid: "u_demo_2", status: "em_andamento", seen: true, min: 95, loja: 1, delivery: "retirada",
        items: [{ name: "Aquário 40 L completo", qty: 1, price: 329 }] },
      { n: 3, uid: "u_demo_1", status: "concluido", seen: true, min: 1480, loja: 2, delivery: "entrega",
        items: [{ name: "Arranhador para gatos", qty: 1, price: 149.9 }] }
    ];

    var linhas = exemplos.map(function (p) {
      var quando = new Date(agora - p.min * 60000).toISOString();
      var cliente = pessoas[p.uid];
      var loja = CFG.stores[p.loja] || CFG.stores[0];
      return {
        id: C.randomId("r_"), number: p.n, customer_id: p.uid,
        store_id: loja.id, kind: KINDS[0], delivery: p.delivery, payment: PAYMENTS[0],
        contact: "WhatsApp", items: p.items, message: "",
        total: p.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
        status: p.status, seen_by_store: p.seen,
        created_at: quando, updated_at: quando, status_changed_at: quando,
        snapshot: {
          store: loja.name + " – " + loja.district,
          customer: { name: cliente.name, phone: cliente.phone, email: cliente.email },
          address: p.delivery === "entrega" ? cliente.address : null
        }
      };
    }).reverse();

    writeLS(DK.requests, linhas);
    localStorage.setItem(DK.seq, JSON.stringify(exemplos.length));
    await demo.setStaffCode("1234");
    notify();
  }
  var DEMO_READY = seedDemo();   // quem precisa dos dados de exemplo espera por esta promessa

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
    saveProfile: saveProfile,
    requestPasswordReset: requestPasswordReset,
    isRecoveryLink: isRecoveryLink,
    updatePassword: updatePassword,
    createRequest: createRequest,
    myRequests: myRequests,
    // painel
    staffLogin: staffLogin,
    staffSession: staffSession,
    staffLogout: staffLogout,
    codeEnter: codeEnter,
    codeRemembered: codeRemembered,
    setStaffCode: setStaffCode,
    staffCodeInfo: staffCodeInfo,
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
