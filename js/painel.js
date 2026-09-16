// Pet Tem Home — painel da loja
//
// Entrada: gestor (e-mail e senha) ou equipe (só o código definido pelo gestor).
// Depois: quadro de solicitações, lista de clientes e, para o gestor, ajustes.

(function () {
  "use strict";

  var API = window.PetAPI;
  var CFG = window.PET_CONFIG;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  var dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
  var GATES = ["gateLoading", "gateLogin", "dashboard"];
  var COLUMNS = [
    { id: "pendente", label: "🟡 Pendentes" },
    { id: "em_andamento", label: "🔵 Em andamento" },
    { id: "concluido", label: "✅ Concluídas" }
  ];

  var state = {
    view: "requests",
    store: "todas",
    q: "",
    cq: "",
    onlyNew: false,
    mobileCol: "pendente",
    sound: localStorage.getItem("ptm_panel_sound") === "1",
    requests: [],
    customers: [],
    known: null,
    unsub: null,
    timer: null
  };

  function show(id) { GATES.forEach(function (g) { $("#" + g).hidden = g !== id; }); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function link(text, href, blank) {
    var a = el("a", "", text);
    a.href = href;
    if (blank) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function showMsg(form, text, type) {
    var box = $("[data-msg]", form);
    box.textContent = text;
    box.className = "form-msg show " + (type || "error");
  }
  function clearMsg(form) { $("[data-msg]", form).className = "form-msg"; }
  function ago(ts) {
    if (!ts) return "";
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "agora";
    if (m < 60) return "há " + m + " min";
    var h = Math.floor(m / 60);
    if (h < 24) return "há " + h + " h";
    var d = Math.floor(h / 24);
    return "há " + d + (d === 1 ? " dia" : " dias");
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function normalize(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  // ================= som =================
  var audioCtx = null;
  function beep() {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175, 1480].forEach(function (freq, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = freq;
        o.connect(g); g.connect(audioCtx.destination);
        var t = audioCtx.currentTime + i * 0.15;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.start(t); o.stop(t + 0.15);
      });
    } catch (e) { /* sem áudio */ }
  }
  function paintSound() {
    $("#soundBtn").firstChild.textContent = state.sound ? "🔔 " : "🔕 ";
    $("#soundBtn").setAttribute("aria-pressed", String(state.sound));
  }
  $("#soundBtn").addEventListener("click", function () {
    state.sound = !state.sound;
    localStorage.setItem("ptm_panel_sound", state.sound ? "1" : "0");
    paintSound();
    if (state.sound) beep();
  });
  paintSound();

  // ================= entrada =================
  async function boot() {
    stopLive();
    show("gateLoading");
    try {
      if (await API.codeRemembered()) { startDashboard(); return; }
      var session = await API.staffSession();
      if (!session) { show("gateLogin"); return; }
      if (!session.isStaff) {
        await API.staffLogout();
        show("gateLogin");
        showMsg($("#staffForm"), "Esta conta não tem acesso ao painel. O painel é da equipe da loja.");
        return;
      }
      startDashboard();
    } catch (err) {
      show("gateLogin");
      showMsg($("#staffForm"), err.message);
    }
  }

  (function accessTabs() {
    var tabs = $("#accessTabs");
    function pick(index) {
      tabs.setAttribute("data-active", String(index));
      $("#tabCode").setAttribute("aria-selected", index === 0 ? "true" : "false");
      $("#tabManager").setAttribute("aria-selected", index === 1 ? "true" : "false");
      $("#codeForm").hidden = index !== 0;
      $("#staffForm").hidden = index !== 1;
    }
    $("#tabCode").addEventListener("click", function () { pick(0); });
    $("#tabManager").addEventListener("click", function () { pick(1); });
  })();

  $("#codeForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = e.target, btn = $("button[type=submit]", form);
    clearMsg(form);
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await API.codeEnter(form.elements.code.value, form.elements.remember.checked);
      form.reset();
      startDashboard();
    } catch (err) {
      showMsg(form, err.message);
      form.elements.code.value = "";
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("#staffForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = e.target, btn = $("button[type=submit]", form);
    clearMsg(form);
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await API.staffLogin(form.elements.email.value, form.elements.password.value);
      form.reset();
      await boot();
    } catch (err) {
      showMsg(form, err.message);
      form.elements.password.value = "";
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar como gestor";
    }
  });

  $("#forgotStaff").addEventListener("click", async function () {
    var form = $("#staffForm");
    var email = form.elements.email.value.trim();
    clearMsg(form);
    if (!email) { showMsg(form, "Digite o e-mail do gestor para receber o link."); return; }
    this.disabled = true;
    try {
      await API.requestPasswordReset(email);
      showMsg(form, "Se existir uma conta com esse e-mail, o link para criar a nova senha chega em alguns minutos. Confira também o spam.", "ok");
    } catch (err) {
      showMsg(form, err.message);
    } finally {
      this.disabled = false;
    }
  });

  $$("[data-logout]").forEach(function (b) {
    b.addEventListener("click", async function () {
      await API.staffLogout();
      state.known = null;
      toast("Você saiu do painel.");
      boot();
    });
  });

  // ================= painel =================
  async function startDashboard() {
    show("dashboard");
    $("#demoBar").hidden = API.mode !== "demo";
    var session = await API.staffSession();
    var isManager = !!(session && session.manager);
    $("#tabSettings").hidden = !isManager;
    $("#staffEmailLabel").textContent = session ? "· " + session.email : "";
    if (isManager) paintCodeInfo();
    refresh();
    state.unsub = API.subscribe(scheduleRefresh);
    state.timer = setInterval(refresh, 20000);
  }
  function stopLive() {
    if (state.unsub) { state.unsub(); state.unsub = null; }
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !$("#dashboard").hidden) refresh();
  });

  var refreshing = false, again = false, debounce = null;
  function scheduleRefresh() {
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 300);
  }

  async function refresh() {
    if ($("#dashboard").hidden) return;
    if (refreshing) { again = true; return; }
    refreshing = true;
    try {
      var list = await API.listRequests();
      var fresh = [];
      if (state.known) {
        list.forEach(function (r) { if (!state.known[r.id]) fresh.push(r); });
      }
      state.known = {};
      list.forEach(function (r) { state.known[r.id] = true; });
      state.requests = list;
      if (fresh.length) {
        beep();
        toast(fresh.length === 1 ? "Nova solicitação " + fresh[0].code + "!" : fresh.length + " novas solicitações!");
      }
      renderRequests();
      if (state.view === "customers") {
        state.customers = await API.listCustomers();
        renderCustomers();
      }
      setLive(true);
    } catch (err) {
      if (err.code === "FORBIDDEN" || err.code === "WRONG_CODE" || err.code === "AUTH") { boot(); return; }
      setLive(false, err.message);
    } finally {
      refreshing = false;
      if (again) { again = false; refresh(); }
    }
  }

  function setLive(ok, message) {
    var live = $("#live");
    live.classList.toggle("off", !ok);
    live.textContent = ok ? "ao vivo · " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "sem conexão";
    live.title = message || "";
  }

  $("#refreshBtn").addEventListener("click", function () { refresh(); toast("Atualizado."); });

  // ---------- abas ----------
  $$("[data-view]").forEach(function (b) {
    b.addEventListener("click", async function () {
      state.view = b.getAttribute("data-view");
      $$("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      $("#viewRequests").hidden = state.view !== "requests";
      $("#viewCustomers").hidden = state.view !== "customers";
      $("#viewSettings").hidden = state.view !== "settings";
      if (state.view === "customers") {
        $("#customers").textContent = "Carregando clientes…";
        try {
          state.customers = await API.listCustomers();
          renderCustomers();
        } catch (err) { $("#customers").textContent = err.message; }
      }
      if (state.view === "settings") paintCodeInfo();
    });
  });

  // ---------- ajustes do gestor ----------
  async function paintCodeInfo() {
    try {
      var info = await API.staffCodeInfo();
      $("#codeInfo").textContent = info.enabled
        ? "Acesso por código ativo" + (info.setAt ? " desde " + dateOnly.format(info.setAt) : "") + "."
        : "Acesso por código desativado: hoje só o gestor entra no painel.";
    } catch (e) { $("#codeInfo").textContent = ""; }
  }

  async function submitSettings(form, label, fn) {
    var btn = $("button[type=submit]", form), original = btn.textContent;
    clearMsg(form);
    btn.disabled = true;
    btn.textContent = label;
    try { await fn(); }
    catch (err) { showMsg(form, err.message); }
    finally { btn.disabled = false; btn.textContent = original; }
  }

  $("#codeSetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    submitSettings(form, "Salvando…", async function () {
      await API.setStaffCode(form.elements.code.value);
      form.reset();
      showMsg(form, "Código salvo. Avise a equipe: é com ele que eles entram no painel.", "ok");
      paintCodeInfo();
    });
  });

  $("#disableCode").addEventListener("click", async function () {
    if (!window.confirm("Desativar o acesso por código? Os funcionários não vão mais conseguir entrar até você criar um novo código.")) return;
    var form = $("#codeSetForm");
    clearMsg(form);
    try {
      await API.setStaffCode(null);
      showMsg(form, "Acesso por código desativado.", "ok");
      paintCodeInfo();
    } catch (err) { showMsg(form, err.message); }
  });

  $("#loginPassForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    submitSettings(form, "Trocando…", async function () {
      await API.updatePassword(form.elements.password.value);
      form.reset();
      showMsg(form, "Senha de login trocada.", "ok");
    });
  });

  // ---------- filtros ----------
  (function fillStores() {
    var sel = $("#storeFilter");
    var all = el("option", "", "Todas as lojas");
    all.value = "todas";
    sel.appendChild(all);
    CFG.stores.forEach(function (s) {
      var o = el("option", "", s.name + " · " + s.district);
      o.value = s.id;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { state.store = sel.value; renderRequests(); });
  })();
  $("#searchRequests").addEventListener("input", function () { state.q = this.value; renderRequests(); });
  $("#onlyNew").addEventListener("change", function () { state.onlyNew = this.checked; renderRequests(); });
  $("#searchCustomers").addEventListener("input", function () { state.cq = this.value; renderCustomers(); });

  // ---------- solicitações ----------
  function matches(r) {
    if (state.store !== "todas" && r.storeId !== state.store) return false;
    if (state.onlyNew && r.seen) return false;
    var q = normalize(state.q.trim());
    if (!q) return true;
    var c = (r.snapshot && r.snapshot.customer) || {};
    var hay = normalize([r.code, r.number, r.kind, c.name, c.phone, r.message].join(" "));
    return hay.indexOf(q) !== -1 || (digits(q) && digits(c.phone).indexOf(digits(q)) !== -1);
  }

  function renderStats(all) {
    var box = $("#stats");
    box.innerHTML = "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    [
      [all.filter(function (r) { return !r.seen; }).length, "Novas"],
      [all.filter(function (r) { return r.status === "pendente"; }).length, "Pendentes"],
      [all.filter(function (r) { return r.status === "em_andamento"; }).length, "Em andamento"],
      [all.filter(function (r) { return r.createdAt >= today.getTime(); }).length, "Recebidas hoje"]
    ].forEach(function (s) {
      var d = el("div", "stat");
      d.appendChild(el("b", "", String(s[0])));
      d.appendChild(el("span", "", s[1]));
      box.appendChild(d);
    });
  }

  function renderRequests() {
    var all = state.requests;
    var visible = all.filter(matches);
    var newCount = all.filter(function (r) { return !r.seen; }).length;

    renderStats(all);
    var badge = $("#newCount");
    badge.hidden = newCount === 0;
    badge.textContent = "🔴 " + newCount + (newCount === 1 ? " nova" : " novas");
    document.title = (newCount ? "(" + newCount + ") " : "") + "Painel da Loja — Pet Tem Home";

    var tabs = $("#colTabs");
    tabs.innerHTML = "";
    var board = $("#board");
    board.innerHTML = "";

    COLUMNS.forEach(function (col) {
      var items = visible.filter(function (r) { return r.status === col.id; });
      if (col.id === "concluido") items = items.slice(0, 60);

      var tab = el("button", "", col.label.replace(/^\S+\s/, "") + " (" + items.length + ")");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(state.mobileCol === col.id));
      tab.addEventListener("click", function () { state.mobileCol = col.id; renderRequests(); });
      tabs.appendChild(tab);

      var box = el("section", "col" + (state.mobileCol === col.id ? " active" : ""));
      var head = el("div", "col-head", col.label);
      head.appendChild(el("span", "", String(items.length)));
      box.appendChild(head);
      var listEl = el("div", "col-list");
      if (!items.length) listEl.appendChild(el("p", "empty-col", "Nenhuma solicitação aqui"));
      items.forEach(function (r) { listEl.appendChild(buildCard(r)); });
      box.appendChild(listEl);
      board.appendChild(box);
    });
  }

  function section(label, content) {
    var s = el("div", "sec");
    s.appendChild(el("span", "k", label));
    if (typeof content === "string") s.appendChild(document.createTextNode(content));
    else s.appendChild(content);
    return s;
  }

  function actionButton(text, cls, fn) {
    var b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", async function () {
      b.disabled = true;
      try { await fn(); await refresh(); }
      catch (err) { toast(err.message); b.disabled = false; }
    });
    return b;
  }

  function buildCard(r) {
    var snap = r.snapshot || {};
    var customer = snap.customer || {};
    var card = el("article", "req " + r.status + (r.seen ? "" : " is-new"));

    var top = el("div", "req-top");
    var left = el("div");
    left.appendChild(el("span", "req-num", r.code));
    if (!r.seen) {
      left.appendChild(document.createTextNode(" "));
      left.appendChild(el("span", "badge-new", "NOVA"));
    }
    top.appendChild(left);
    top.appendChild(el("span", "req-when", ago(r.createdAt)));
    card.appendChild(top);

    var chips = el("div", "chips-row");
    var store = API.storeById(r.storeId);
    [r.kind, store ? store.name : r.storeId, r.delivery === "entrega" ? "🛵 Entrega" : "🏪 Retirada"].forEach(function (t) {
      chips.appendChild(el("span", "chip-s", t));
    });
    card.appendChild(chips);

    var who = el("p", "req-who");
    who.appendChild(el("b", "", customer.name || "Cliente"));
    if (r.items.length) {
      var first = r.items[0];
      who.appendChild(document.createTextNode(" solicitou " + first.qty + "× " + first.name + (r.items.length > 1 ? " e mais " + (r.items.length - 1) : "")));
    } else {
      who.appendChild(document.createTextNode(" enviou: " + r.kind.toLowerCase()));
    }
    card.appendChild(who);

    if (customer.phone) {
      var contact = el("div");
      var phone = digits(customer.phone);
      contact.appendChild(link(customer.phone, "tel:" + phone));
      contact.appendChild(document.createTextNode(" · "));
      contact.appendChild(link("WhatsApp ↗", "https://wa.me/55" + phone.replace(/^55/, "") + "?text=" + encodeURIComponent("Olá, " + API.firstName(customer.name) + "! Aqui é da Pet Tem Home, sobre a solicitação " + r.code + "."), true));
      if (r.contact) contact.appendChild(document.createTextNode(" · prefere " + r.contact));
      card.appendChild(section("Cliente", contact));
    }

    if (r.items.length) {
      var ul = el("ul");
      r.items.forEach(function (i) { ul.appendChild(el("li", "", i.qty + "× " + i.name + " — " + money.format(i.price * i.qty))); });
      card.appendChild(section("Itens", ul));
    }
    if (r.message) card.appendChild(section("Mensagem", r.message));

    if (r.delivery === "entrega" && snap.address) {
      var a = snap.address;
      var addr = el("div");
      addr.appendChild(document.createTextNode(a.street + ", " + a.number + (a.complement ? " – " + a.complement : "")));
      addr.appendChild(el("br"));
      addr.appendChild(document.createTextNode(a.district + (a.cep ? " · CEP " + a.cep : "") + (a.city ? " · " + a.city : "")));
      if (a.reference) { addr.appendChild(el("br")); addr.appendChild(document.createTextNode("Ref.: " + a.reference)); }
      addr.appendChild(el("br"));
      addr.appendChild(link("Abrir rota ↗", "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(a.street + ", " + a.number + ", " + a.district + ", " + (a.city || "Francisco Morato - SP")), true));
      card.appendChild(section("Entregar em", addr));
    }

    card.appendChild(section("Pagamento", r.payment + " (na entrega ou retirada)"));
    if (r.total) {
      var total = el("div", "total");
      total.appendChild(el("span", "", snap.store || ""));
      total.appendChild(el("b", "", money.format(r.total)));
      card.appendChild(total);
    }

    var times = el("p", "times", "Recebida " + dateTime.format(r.createdAt));
    if (r.status !== "pendente" && r.statusChangedAt) times.textContent += " · " + API.STATUS_LABEL[r.status] + " " + dateTime.format(r.statusChangedAt);
    card.appendChild(times);

    var actions = el("div", "actions");
    if (r.status === "pendente") {
      actions.appendChild(actionButton("▶ Iniciar atendimento", "primary", function () { return API.setStatus(r.id, "em_andamento"); }));
    } else if (r.status === "em_andamento") {
      actions.appendChild(actionButton("✓ Concluir", "primary", function () { return API.setStatus(r.id, "concluido"); }));
      actions.appendChild(actionButton("↩ Pendente", "", function () { return API.setStatus(r.id, "pendente"); }));
    } else {
      actions.appendChild(actionButton("↺ Reabrir", "", function () { return API.setStatus(r.id, "em_andamento"); }));
    }
    if (!r.seen) actions.appendChild(actionButton("👁 Marcar como vista", "", function () { return API.markSeen(r.id); }));
    card.appendChild(actions);
    return card;
  }

  // ---------- clientes ----------
  function renderCustomers() {
    var box = $("#customers");
    var q = normalize(state.cq.trim());
    var list = state.customers.filter(function (c) {
      if (!q) return true;
      var p = c.profile || {};
      var a = p.address || {};
      var hay = normalize([p.name, p.email, p.phone, a.district, a.street].join(" "));
      return hay.indexOf(q) !== -1 || (digits(q) && digits(p.phone).indexOf(digits(q)) !== -1);
    });
    $("#customerCount").textContent = list.length + (list.length === 1 ? " cliente" : " clientes");
    box.innerHTML = "";
    if (!list.length) {
      box.appendChild(el("p", "empty-col", "Nenhum cliente encontrado."));
      return;
    }
    list.forEach(function (c) {
      var p = c.profile || {};
      var card = el("article", "cust");
      card.appendChild(el("h3", "", p.name || "Cliente"));
      if (p.phone) {
        var contact = el("p");
        var phone = digits(p.phone);
        contact.appendChild(link(p.phone, "tel:" + phone));
        contact.appendChild(document.createTextNode(" · "));
        contact.appendChild(link("WhatsApp ↗", "https://wa.me/55" + phone.replace(/^55/, ""), true));
        card.appendChild(contact);
      }
      if (p.email) {
        var mail = el("p");
        mail.appendChild(link(p.email, "mailto:" + p.email));
        card.appendChild(mail);
      }
      var a = p.address || {};
      if (a.street) {
        card.appendChild(el("p", "", a.street + ", " + a.number + (a.complement ? " – " + a.complement : "") + " · " + a.district + (a.cep ? " · CEP " + a.cep : "")));
      }
      var meta = el("div", "meta");
      meta.appendChild(el("span", "chip-s", "📦 " + c.requests + (c.requests === 1 ? " solicitação" : " solicitações")));
      if (c.createdAt) meta.appendChild(el("span", "chip-s", "Cliente desde " + dateOnly.format(c.createdAt)));
      if (c.lastLoginAt) meta.appendChild(el("span", "chip-s", "Último acesso " + ago(c.lastLoginAt)));
      card.appendChild(meta);
      box.appendChild(card);
    });
  }

  // ---------- demonstração ----------
  $("#resetDemo").addEventListener("click", function () {
    if (!window.confirm("Apagar contas, solicitações e o código de demonstração deste navegador?")) return;
    API.clearDemoData();
    state.known = null;
    toast("Demonstração apagada.");
    boot();
  });

  boot();
})();
