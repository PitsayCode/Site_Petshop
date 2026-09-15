// Pet Tem Home — página "Minha conta": entrar, criar conta, pedidos e perfil

(function () {
  "use strict";

  var API = window.PetAPI;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var params = new URLSearchParams(window.location.search);
  var goingToCheckout = params.get("next") === "checkout" || sessionStorage.getItem("ptm_next") === "checkout";

  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
  var STATUS = {
    novo: "🟡 Pedido recebido",
    separando: "📦 Separando",
    saiu: "🛵 A caminho / pronto",
    entregue: "✅ Concluído",
    cancelado: "✖ Cancelado"
  };

  function showMsg(form, text, type) {
    var box = $("[data-msg]", form);
    box.textContent = text;
    box.className = "form-msg show " + (type || "error");
  }
  function clearMsg(form) { $("[data-msg]", form).className = "form-msg"; }

  async function busy(button, label, fn) {
    var original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try { return await fn(); }
    finally { button.disabled = false; button.textContent = original; }
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // ---------- Abas ----------
  var tabs = $("#tabs");
  function selectTab(index) {
    tabs.setAttribute("data-active", String(index));
    $("#tabLogin").setAttribute("aria-selected", index === 0 ? "true" : "false");
    $("#tabSignup").setAttribute("aria-selected", index === 1 ? "true" : "false");
    $("#loginForm").hidden = index !== 0;
    $("#signupForm").hidden = index !== 1;
  }
  $("#tabLogin").addEventListener("click", function () { selectTab(0); });
  $("#tabSignup").addEventListener("click", function () { selectTab(1); });
  if (params.get("tab") === "cadastro") selectTab(1);

  // ---------- Força da senha ----------
  $("#suPassword").addEventListener("input", function (e) {
    var pw = e.target.value, score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    var colors = ["var(--danger)", "var(--danger)", "var(--sun)", "var(--moss)", "var(--forest)"];
    var bar = $("#pwBar");
    bar.style.width = (score / 4 * 100) + "%";
    bar.style.background = colors[score];
  });

  // ---------- Máscaras simples ----------
  function maskPhone(input) {
    input.addEventListener("input", function () {
      var d = input.value.replace(/\D/g, "").slice(0, 11);
      if (d.length > 6) input.value = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      else if (d.length > 2) input.value = "(" + d.slice(0, 2) + ") " + d.slice(2);
      else input.value = d;
    });
  }
  function maskCep(input) {
    input.addEventListener("input", function () {
      var d = input.value.replace(/\D/g, "").slice(0, 8);
      input.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    });
  }
  maskPhone($("#suPhone")); maskPhone($("#pfPhone"));
  maskCep($("#suCep")); maskCep($("#pfCep"));

  function profileFrom(form) {
    var f = new FormData(form);
    var get = function (k) { return String(f.get(k) || "").trim(); };
    return {
      name: get("name"),
      email: get("email").toLowerCase(),
      phone: get("phone"),
      address: {
        street: get("street"), number: get("number"), complement: get("complement"),
        district: get("district"), cep: get("cep"), city: get("city"), reference: get("reference")
      }
    };
  }

  function afterAuth() {
    if (goingToCheckout) {
      sessionStorage.removeItem("ptm_next");
      sessionStorage.setItem("ptm_open_cart", "1");
      window.location.href = "index.html#produtos";
      return;
    }
    render();
  }

  // ---------- Entrar ----------
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    var f = new FormData(form);
    busy($("button[type=submit]", form), "Verificando com segurança…", async function () {
      try {
        await API.login(String(f.get("email") || ""), String(f.get("password") || ""));
        form.reset();
        afterAuth();
      } catch (err) {
        showMsg(form, err.message);
        $("#loginPassword").value = "";
      }
    });
  });

  // ---------- Criar conta ----------
  $("#signupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    var f = new FormData(form);
    if (f.get("password") !== f.get("password2")) { showMsg(form, "As senhas não são iguais."); return; }
    if (!f.get("consent")) { showMsg(form, "Precisamos da sua autorização para usar os dados na entrega."); return; }
    busy($("button[type=submit]", form), "Criptografando seus dados…", async function () {
      try {
        await API.register(profileFrom(form), String(f.get("password")));
        form.reset();
        toast("Conta criada! 🐾");
        afterAuth();
      } catch (err) {
        showMsg(form, err.message);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ---------- Minha conta ----------
  async function renderOrders() {
    var list = $("#ordersList");
    var orders = await API.myOrders();
    list.innerHTML = "";
    if (!orders.length) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Você ainda não fez pedidos pelo site.";
      list.appendChild(empty);
      return;
    }
    orders.forEach(function (o) {
      var row = document.createElement("div");
      row.className = "order-row";
      var top = document.createElement("div");
      top.className = "top";
      var code = document.createElement("b");
      code.textContent = o.code;
      var status = document.createElement("span");
      status.className = "status " + o.status;
      status.textContent = STATUS[o.status] || o.status;
      top.appendChild(code); top.appendChild(status);
      var info = document.createElement("small");
      info.textContent = dateFmt.format(o.createdAt) + " · " + o.store + " · " +
        (o.delivery.type === "entrega" ? "Entrega" : "Retirada") + " · " + money.format(o.total);
      var items = document.createElement("p");
      items.style.cssText = "font-size:14px;margin-top:6px;";
      items.textContent = o.items.map(function (i) { return i.qty + "× " + i.name; }).join(", ");
      row.appendChild(top); row.appendChild(info); row.appendChild(items);
      list.appendChild(row);
    });
  }

  function fillProfile(p) {
    var form = $("#profileForm");
    var a = p.address || {};
    var values = { name: p.name, email: p.email, phone: p.phone, street: a.street, number: a.number, complement: a.complement, district: a.district, cep: a.cep, city: a.city, reference: a.reference };
    Object.keys(values).forEach(function (k) { form.elements[k].value = values[k] || ""; });
  }

  $("#profileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    busy($("button[type=submit]", form), "Salvando…", async function () {
      try {
        await API.updateProfile(profileFrom(form));
        showMsg(form, "Dados atualizados.", "ok");
      } catch (err) { showMsg(form, err.message); }
    });
  });

  $("#logoutBtn").addEventListener("click", async function () {
    await API.logout();
    toast("Você saiu da sua conta.");
    render();
  });

  async function render() {
    var me = await API.currentUser();
    $("#checkoutBanner").classList.toggle("show", goingToCheckout && !me);
    $("#authView").hidden = !!me;
    $("#accountView").hidden = !me;
    if (!me) return;
    $("#helloName").textContent = "Olá, " + API.firstName(me.profile.name) + "! 🐾";
    fillProfile(me.profile);
    renderOrders();
  }

  API.onChange(function () {
    if (!$("#accountView").hidden) renderOrders();
  });

  render();
})();
