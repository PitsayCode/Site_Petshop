// Bosque Pet — formulário de solicitação

(function () {
  "use strict";

  var API = window.PetAPI;
  var CFG = window.PET_CONFIG;
  var PRODUCTS = window.PET_PRODUCTS || [];
  var $ = function (sel) { return document.querySelector(sel); };
  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
  var VIEWS = ["reqLoading", "reqAuth", "reqProfile", "reqForm", "reqDone"];

  var PLACEHOLDER = {
    "Pedido de produtos": "Ex.: ração para cachorro adulto porte médio, a mesma marca da última compra.",
    "Encomenda de produto": "Qual produto você procura? Marca, tamanho, quantidade…",
    "Orçamento": "Conte o que precisa orçar (ex.: montar um aquário de 60 litros).",
    "Dúvida ou outro assunto": "Escreva sua dúvida para a equipe da loja."
  };

  var me = null;

  function show(id) { VIEWS.forEach(function (v) { $("#" + v).hidden = v !== id; }); }
  function productById(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }
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
  function radio(group, name, value, label, checked) {
    var id = name + "_" + group.children.length;
    var input = el("input");
    input.type = "radio"; input.name = name; input.id = id; input.value = value; input.checked = !!checked;
    var lab = el("label", "", label);
    lab.htmlFor = id;
    group.appendChild(input);
    group.appendChild(lab);
    return input;
  }

  // ---------- aviso de modo ----------
  var note = $("#modeNote");
  if (API.mode === "demo") {
    note.textContent = "Modo demonstração: a solicitação fica salva só neste navegador. Abra o painel da loja nesta mesma janela para ver ela chegar.";
    note.className = "form-msg ok show";
  } else if (API.mode === "offline") {
    note.textContent = "Não conseguimos conectar ao sistema da loja. Verifique a internet e recarregue a página.";
    note.className = "form-msg error show";
  }

  // ---------- campos fixos ----------
  var params = new URLSearchParams(window.location.search);
  var cartHasItems = API.cart.get().length > 0;
  var wantedKind = API.KINDS.indexOf(params.get("tipo")) !== -1 ? params.get("tipo") : (cartHasItems ? API.KINDS[0] : API.KINDS[3]);
  API.KINDS.forEach(function (k) { radio($("#kindGroup"), "kind", k, k, k === wantedKind); });
  API.PAYMENTS.forEach(function (p, i) { radio($("#payGroup"), "payment", p, p, i === 0); });
  CFG.stores.forEach(function (s) {
    var o = el("option", "", s.name + " – " + s.district);
    o.value = s.id;
    $("#storeSelect").appendChild(o);
  });

  function updateKind() {
    var kind = (document.querySelector("input[name=kind]:checked") || {}).value;
    $("#message").placeholder = PLACEHOLDER[kind] || "";
    $("#messageLabel").textContent = kind === "Pedido de produtos" ? "Observações (opcional se escolheu produtos)" : "Descreva sua solicitação";
  }
  $("#kindGroup").addEventListener("change", updateKind);
  updateKind();

  $("#message").addEventListener("input", function () { $("#messageCount").textContent = String(this.value.length); });

  function updateAddress() {
    var delivery = (document.querySelector("input[name=delivery]:checked") || {}).value;
    var line = $("#addressLine");
    line.innerHTML = "";
    if (delivery === "entrega" && me && me.profile) {
      var a = me.profile.address || {};
      line.appendChild(document.createTextNode("Entregar em: " + a.street + ", " + a.number + (a.complement ? " – " + a.complement : "") + " · " + a.district + " "));
      var edit = el("a", "req-link", "alterar");
      edit.href = "login.html#dados";
      line.appendChild(edit);
    } else {
      var store = API.storeById($("#storeSelect").value);
      line.textContent = store ? "Retirada em: " + store.address : "";
    }
  }
  document.querySelectorAll("input[name=delivery]").forEach(function (i) { i.addEventListener("change", updateAddress); });
  $("#storeSelect").addEventListener("change", updateAddress);

  // ---------- itens da sacola ----------
  function keyOf(i) { return i.id + "|" + (i.variant || ""); }
  function cartLines() {
    return API.cart.get().map(function (i) {
      var p = productById(i.id);
      return p ? { key: keyOf(i), name: p.name + (i.variant ? " – " + i.variant : ""), qty: i.qty, price: p.price, emoji: p.emoji } : null;
    }).filter(Boolean);
  }
  function changeQty(key, delta) {
    API.cart.set(API.cart.get().map(function (i) {
      if (keyOf(i) === key) i.qty = Math.min(20, i.qty + delta);
      return i;
    }).filter(function (i) { return i.qty > 0; }));
  }

  function renderItems() {
    var box = $("#itemsBox");
    var lines = cartLines();
    box.innerHTML = "";
    if (!lines.length) {
      box.appendChild(el("p", "req-muted", "Nenhum produto na sacola. Você pode descrever o que precisa no campo de detalhes."));
    }
    lines.forEach(function (l) {
      var row = el("div", "req-item");
      var emoji = el("span", "req-item-emoji", l.emoji);
      emoji.setAttribute("aria-hidden", "true");
      var info = el("div", "req-item-info");
      info.appendChild(el("b", "", l.name));
      info.appendChild(el("small", "", money.format(l.price) + " cada"));
      var qty = el("div", "qty");
      var minus = el("button", "", "−"); minus.type = "button"; minus.setAttribute("aria-label", "Diminuir " + l.name);
      var plus = el("button", "", "+"); plus.type = "button"; plus.setAttribute("aria-label", "Aumentar " + l.name);
      minus.addEventListener("click", function () { changeQty(l.key, -1); });
      plus.addEventListener("click", function () { changeQty(l.key, 1); });
      qty.appendChild(minus); qty.appendChild(el("span", "", String(l.qty))); qty.appendChild(plus);
      row.appendChild(emoji); row.appendChild(info); row.appendChild(qty);
      box.appendChild(row);
    });
    var count = lines.reduce(function (s, l) { return s + l.qty; }, 0);
    var total = lines.reduce(function (s, l) { return s + l.qty * l.price; }, 0);
    $("#sumItems").textContent = String(count);
    $("#sumTotal").textContent = money.format(total);
  }

  API.onChange(function () { if (!$("#reqForm").hidden) renderItems(); });

  // ---------- envio ----------
  var formMsg = $("#formMsg");
  $("#requestForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    formMsg.className = "form-msg";
    var f = new FormData(e.target);
    var btn = $("#sendBtn");
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      var lines = cartLines();
      var result = await API.createRequest({
        kind: f.get("kind"),
        storeId: f.get("store"),
        delivery: f.get("delivery"),
        payment: f.get("payment"),
        contact: f.get("contact"),
        message: f.get("message"),
        items: lines.map(function (l) { return { name: l.name, qty: l.qty, price: l.price }; })
      });
      if (lines.length) API.cart.clear();
      e.target.reset();
      renderDone(result);
    } catch (err) {
      formMsg.textContent = err.message;
      formMsg.className = "form-msg error show";
      formMsg.scrollIntoView({ behavior: "smooth", block: "center" });
      if (err.code === "AUTH") show("reqAuth");
      if (err.code === "PROFILE") show("reqProfile");
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar solicitação";
    }
  });

  function renderDone(r) {
    $("#doneNumber").textContent = r.code;
    $("#doneDate").textContent = dateFmt.format(r.createdAt);
    $("#doneStatus").textContent = r.statusLabel;
    $("#doneStore").textContent = (r.snapshot && r.snapshot.store) || "";
    $("#doneKind").textContent = r.kind;
    $("#doneWhats").href = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent("Olá! Enviei a solicitação " + r.code + " pelo site da Bosque Pet 🐾");
    show("reqDone");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Solicitação " + r.code + " enviada!");
  }

  $("#newRequest").addEventListener("click", function () {
    renderItems();
    updateAddress();
    show("reqForm");
  });

  // ---------- início ----------
  (async function init() {
    try {
      me = await API.currentUser();
    } catch (err) {
      me = null;
    }
    if (!me) { show("reqAuth"); return; }
    if (!me.profile) { show("reqProfile"); return; }
    $("#helloLine").textContent = "Olá, " + API.firstName(me.profile.name) + "! Preencha e envie. A loja recebe na hora.";
    renderItems();
    updateAddress();
    show("reqForm");
  })();
})();
