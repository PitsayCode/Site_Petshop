// Pet Tem Home — painel de comandas (HUD da loja)
//
// A chave privada é gerada aqui, como NÃO exportável, e guardada no cofre
// (IndexedDB) deste computador. Só este painel abre as comandas.

(function () {
  "use strict";

  var C = window.PetCrypto;
  var API = window.PetAPI;
  var CFG = window.PET_CONFIG;
  var $ = function (sel) { return document.querySelector(sel); };

  var PRIVATE_KEY_NAME = "store-private-key";
  var LOCAL_PUB = "ptm_panel_pubkey";

  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

  var COLUMNS = [
    { id: "novo", label: "🟡 Novos", next: "separando", nextLabel: "Separar" },
    { id: "separando", label: "📦 Separando", next: "saiu", nextLabel: "Saiu / pronto" },
    { id: "saiu", label: "🛵 A caminho", next: "entregue", nextLabel: "Concluir" },
    { id: "entregue", label: "✅ Concluídos", next: null }
  ];

  var state = {
    privateKey: null,
    store: "todas",
    showCipher: false,
    sound: false,
    seen: null,
    cache: {}
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function ago(ts) {
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "agora";
    if (m < 60) return "há " + m + " min";
    var h = Math.floor(m / 60);
    return h < 24 ? "há " + h + " h" : new Date(ts).toLocaleDateString("pt-BR");
  }

  // ---------- chave do painel ----------
  async function ensureKeys() {
    var priv = await C.vaultGet(PRIVATE_KEY_NAME);
    var pub = JSON.parse(localStorage.getItem(LOCAL_PUB) || "null");
    if (!priv || !pub) {
      var pair = await C.generateStoreKeyPair();
      await C.vaultSet(PRIVATE_KEY_NAME, pair.privateKey);
      localStorage.setItem(LOCAL_PUB, JSON.stringify(pair.publicJwk));
      priv = pair.privateKey;
      pub = pair.publicJwk;
    }
    state.privateKey = priv;
    API.publishStorePublicKey(pub);

    var fp = await C.publicKeyFingerprint(pub);
    $("#keyChip").textContent = "🔑 Chave ativa · " + fp;

    if (CFG.storePublicKeyJwk && (CFG.storePublicKeyJwk.x !== pub.x || CFG.storePublicKeyJwk.y !== pub.y)) {
      $("#demoNote").textContent = "Atenção: a chave pública em js/config.js é de outro painel. Pedidos novos não poderão ser abertos aqui.";
    }

    $("#copyKeyBtn").addEventListener("click", async function () {
      var text = JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y });
      try {
        await navigator.clipboard.writeText(text);
        toast("Chave pública copiada. Cole em storePublicKeyJwk no js/config.js");
      } catch (e) {
        window.prompt("Copie a chave pública:", text);
      }
    });
  }

  async function open(order) {
    if (state.cache[order.id] !== undefined) return state.cache[order.id];
    try {
      state.cache[order.id] = await C.openSealed(order.forStore, state.privateKey);
    } catch (e) {
      state.cache[order.id] = null;
    }
    return state.cache[order.id];
  }

  // ---------- som de nova comanda ----------
  var audioCtx = null;
  function beep() {
    if (!state.sound) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach(function (freq, i) {
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq;
      o.connect(g); g.connect(audioCtx.destination);
      var t = audioCtx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    });
  }
  $("#soundBtn").addEventListener("click", function () {
    state.sound = !state.sound;
    this.textContent = state.sound ? "🔔 Som" : "🔕 Som";
    this.setAttribute("aria-pressed", String(state.sound));
    if (state.sound) beep();
  });

  $("#cipherBtn").addEventListener("click", function () {
    state.showCipher = !state.showCipher;
    this.setAttribute("aria-pressed", String(state.showCipher));
    this.textContent = state.showCipher ? "Ocultar dados cifrados" : "Ver dados cifrados";
    render();
  });

  $("#resetBtn").addEventListener("click", function () {
    if (!window.confirm("Apagar contas, pedidos e atividades de demonstração deste navegador?")) return;
    API.clearDemoData();
    state.cache = {};
    render();
    toast("Dados de demonstração apagados.");
  });

  // ---------- filtros por loja ----------
  var tabs = $("#storeTabs");
  [{ id: "todas", name: "Todas as lojas" }].concat(CFG.stores).forEach(function (s) {
    var b = el("button", "chip", s.id === "todas" ? s.name : s.name + " · " + s.district);
    b.type = "button";
    b.setAttribute("aria-pressed", s.id === state.store ? "true" : "false");
    b.addEventListener("click", function () {
      state.store = s.id;
      Array.prototype.forEach.call(tabs.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      render();
    });
    tabs.appendChild(b);
  });

  // ---------- comanda ----------
  function section(label, content) {
    var s = el("div", "c-sec");
    s.appendChild(el("span", "k", label));
    if (typeof content === "string") s.appendChild(document.createTextNode(content));
    else s.appendChild(content);
    return s;
  }

  function buildCard(order, data, col, isFresh) {
    var card = el("article", "comanda " + order.status + (isFresh ? " fresh" : ""));
    var top = el("div", "c-top");
    top.appendChild(el("span", "", data ? data.code : "Comanda"));
    top.appendChild(el("span", "", timeFmt.format(order.createdAt) + " · " + ago(order.createdAt)));
    card.appendChild(top);

    if (!data) {
      card.appendChild(el("p", "locked", "🔒 Comanda lacrada para outro painel. Esta chave não consegue abri-la."));
    } else {
      var head = el("p", "c-head");
      head.appendChild(el("b", "", API.firstName(data.customer.name)));
      var first = data.items[0];
      var more = data.items.length > 1 ? " e mais " + (data.items.length - 1) + " item(ns)" : "";
      head.appendChild(document.createTextNode(" solicitou " + first.qty + "× " + first.name + more));
      card.appendChild(head);

      var list = el("ul", "c-items");
      data.items.forEach(function (i) { list.appendChild(el("li", "", i.qty + "× " + i.name + " — " + money.format(i.price * i.qty))); });
      card.appendChild(section("Itens", list));

      var contact = el("div");
      contact.appendChild(document.createTextNode(data.customer.name + " · "));
      var tel = el("a", "", data.customer.phone);
      tel.href = "tel:" + String(data.customer.phone).replace(/\D/g, "");
      contact.appendChild(tel);
      card.appendChild(section("Cliente", contact));

      if (data.delivery.type === "entrega" && data.delivery.address) {
        var a = data.delivery.address;
        var addr = el("div");
        addr.appendChild(document.createTextNode(a.street + ", " + a.number + (a.complement ? " – " + a.complement : "")));
        addr.appendChild(el("br"));
        addr.appendChild(document.createTextNode(a.district + (a.cep ? " · CEP " + a.cep : "") + (a.city ? " · " + a.city : "")));
        if (a.reference) { addr.appendChild(el("br")); addr.appendChild(document.createTextNode("Ref.: " + a.reference)); }
        var route = el("a", "", "Abrir rota ↗");
        route.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(a.street + ", " + a.number + ", " + a.district + ", " + (a.city || "Francisco Morato - SP"));
        route.target = "_blank"; route.rel = "noopener noreferrer";
        addr.appendChild(el("br")); addr.appendChild(route);
        card.appendChild(section("🛵 Entregar em", addr));
      } else {
        card.appendChild(section("🏪 Retirada", data.store));
      }

      card.appendChild(section("Pagamento", data.payment + (data.notes ? " · Obs.: " + data.notes : "")));
      var total = el("div", "c-total");
      total.appendChild(el("span", "", data.store));
      total.appendChild(el("b", "", money.format(data.total)));
      card.appendChild(total);
    }

    if (state.showCipher) {
      card.appendChild(el("div", "cipher", "Como está salvo no banco:\n" + JSON.stringify(order.forStore)));
    }

    var actions = el("div", "c-actions");
    if (col.next) {
      var next = el("button", "primary", col.nextLabel);
      next.type = "button";
      next.addEventListener("click", function () { API.setOrderStatus(order.id, col.next); render(); });
      actions.appendChild(next);
    }
    if (order.status !== "entregue" && order.status !== "cancelado") {
      var cancel = el("button", "", "Cancelar");
      cancel.type = "button";
      cancel.addEventListener("click", function () {
        if (window.confirm("Cancelar esta comanda?")) { API.setOrderStatus(order.id, "cancelado"); render(); }
      });
      actions.appendChild(cancel);
    }
    if (actions.children.length) card.appendChild(actions);
    return card;
  }

  // ---------- render ----------
  var rendering = false, pending = false;
  async function render() {
    if (!state.privateKey) return;
    if (rendering) { pending = true; return; }
    rendering = true;
    try {
      var orders = API.rawOrders().filter(function (o) { return state.store === "todas" || o.storeId === state.store; });
      var opened = await Promise.all(orders.map(open));

      var ids = API.rawOrders().map(function (o) { return o.id; });
      var fresh = {};
      if (state.seen) {
        ids.forEach(function (id) { if (!state.seen[id]) fresh[id] = true; });
        if (Object.keys(fresh).length) beep();
      }
      state.seen = state.seen || {};
      ids.forEach(function (id) { state.seen[id] = true; });

      var board = $("#board");
      board.innerHTML = "";
      COLUMNS.forEach(function (col) {
        var items = orders.map(function (o, i) { return { o: o, d: opened[i] }; })
          .filter(function (x) { return col.id === "entregue" ? (x.o.status === "entregue" || x.o.status === "cancelado") : x.o.status === col.id; });
        var box = el("section", "col");
        var head = el("div", "col-head", col.label);
        head.appendChild(el("span", "", String(items.length)));
        box.appendChild(head);
        var list = el("div", "col-list");
        if (!items.length) list.appendChild(el("p", "empty-col", "Nenhuma comanda"));
        items.forEach(function (x) { list.appendChild(buildCard(x.o, x.d, col, fresh[x.o.id])); });
        box.appendChild(list);
        board.appendChild(box);
      });

      await renderFeed();
      var novos = orders.filter(function (o) { return o.status === "novo"; }).length;
      document.title = (novos ? "(" + novos + ") " : "") + "Painel de Comandas — Pet Tem Home";
    } finally {
      rendering = false;
      if (pending) { pending = false; render(); }
    }
  }

  async function renderFeed() {
    var feed = $("#feed");
    var events = API.rawEvents().slice(0, 40).map(function (e) { return { kind: "event", at: e.at, raw: e }; });
    var orders = API.rawOrders().slice(0, 40).map(function (o) { return { kind: "order", at: o.createdAt, raw: o }; });
    var all = events.concat(orders).sort(function (a, b) { return b.at - a.at; }).slice(0, 40);

    var rows = await Promise.all(all.map(async function (item) {
      var li = el("li");
      var text = el("div");
      if (item.kind === "order") {
        var d = await open(item.raw);
        li.appendChild(el("i", "", "🧾"));
        text.appendChild(document.createTextNode(d
          ? API.firstName(d.customer.name) + " solicitou " + d.items[0].qty + "× " + d.items[0].name + (d.items.length > 1 ? " e mais itens" : "")
          : "Nova comanda (lacrada para outro painel)"));
      } else {
        var ev = null;
        try { ev = await C.openSealed(item.raw.box, state.privateKey); } catch (e) { ev = null; }
        li.appendChild(el("i", "", ev && ev.type === "signup" ? "🌱" : "👋"));
        text.appendChild(document.createTextNode(ev
          ? ev.name + (ev.type === "signup" ? " criou uma conta" : " fez login")
          : "Atividade lacrada"));
      }
      text.appendChild(el("small", "", ago(item.at)));
      li.appendChild(text);
      return li;
    }));

    feed.innerHTML = "";
    if (!rows.length) feed.appendChild(el("li", "", "Aguardando clientes… 🐾"));
    rows.forEach(function (r) { feed.appendChild(r); });
  }

  ensureKeys().then(render).catch(function (err) {
    $("#keyChip").textContent = "⚠️ " + err.message;
  });
  API.onChange(render);
  setInterval(render, 15000);
})();
