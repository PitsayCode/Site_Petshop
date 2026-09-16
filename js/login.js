// Pet Tem Home — Minha conta: entrar, criar conta, recuperar senha,
// completar cadastro, solicitações e dados de entrega

(function () {
  "use strict";

  var API = window.PetAPI;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var params = new URLSearchParams(window.location.search);
  var next = params.get("next") === "solicitacao" || params.get("next") === "checkout" ? "solicitacao" : null;
  var VIEWS = ["loadingView", "authView", "forgotView", "recoveryView", "completeView", "accountView"];

  var dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  function show(id) {
    VIEWS.forEach(function (v) { $("#" + v).hidden = v !== id; });
    $("#nextBanner").classList.toggle("show", !!next && (id === "authView" || id === "completeView"));
  }
  function showMsg(form, text, type) {
    var box = $("[data-msg]", form);
    box.textContent = text;
    box.className = "form-msg show " + (type || "error");
  }
  function clearMsg(form) { $("[data-msg]", form).className = "form-msg"; }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  async function busy(button, label, fn) {
    var original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try { return await fn(); }
    finally { button.disabled = false; button.textContent = original; }
  }

  // ---------- aviso de modo ----------
  var note = $("#modeNote");
  if (API.mode === "demo") {
    note.textContent = "Modo demonstração: as contas ficam salvas só neste navegador.";
    note.className = "form-msg ok show";
  } else if (API.mode === "offline") {
    note.textContent = "Sem conexão com o sistema da loja. Verifique a internet e recarregue.";
    note.className = "form-msg error show";
  }

  // ---------- campos de cadastro (reaproveitados em 3 formulários) ----------
  var FIELDS =
    '<fieldset><legend>Seus dados</legend>' +
      '<div class="field"><label for="{p}Name">Nome completo</label><input id="{p}Name" name="name" autocomplete="name" required></div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="{p}Email">E-mail</label><input id="{p}Email" name="email" type="email" autocomplete="email" required></div>' +
        '<div class="field"><label for="{p}Phone">Celular / WhatsApp</label><input id="{p}Phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 90000-0000" required></div>' +
      '</div>' +
    '</fieldset>' +
    '<fieldset><legend>Endereço de entrega</legend>' +
      '<div class="field-row r3">' +
        '<div class="field"><label for="{p}Street">Rua</label><input id="{p}Street" name="street" autocomplete="address-line1" required></div>' +
        '<div class="field"><label for="{p}Number">Número</label><input id="{p}Number" name="number" inputmode="numeric" required></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="{p}Complement">Complemento</label><input id="{p}Complement" name="complement" autocomplete="address-line2"></div>' +
        '<div class="field"><label for="{p}District">Bairro</label><input id="{p}District" name="district" required></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="{p}Cep">CEP</label><input id="{p}Cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="07900-000"></div>' +
        '<div class="field"><label for="{p}City">Cidade</label><input id="{p}City" name="city" value="Francisco Morato – SP" autocomplete="address-level2"></div>' +
      '</div>' +
      '<div class="field"><label for="{p}Ref">Ponto de referência</label><input id="{p}Ref" name="reference" placeholder="Ex.: portão verde, ao lado da padaria"></div>' +
    '</fieldset>';

  $$("[data-profile-fields]").forEach(function (box) {
    var prefix = box.getAttribute("data-profile-fields");
    box.innerHTML = FIELDS.replace(/\{p\}/g, prefix);
    if (box.hasAttribute("data-readonly-email")) $("input[name=email]", box).readOnly = true;
    var phone = $("input[name=phone]", box);
    phone.addEventListener("input", function () {
      var d = phone.value.replace(/\D/g, "").slice(0, 11);
      if (d.length > 6) phone.value = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      else if (d.length > 2) phone.value = "(" + d.slice(0, 2) + ") " + d.slice(2);
      else phone.value = d;
    });
    var cep = $("input[name=cep]", box);
    cep.addEventListener("input", function () {
      var d = cep.value.replace(/\D/g, "").slice(0, 8);
      cep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    });
  });

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

  function fillProfile(form, p) {
    var a = (p && p.address) || {};
    var values = { name: p && p.name, email: p && p.email, phone: p && p.phone, street: a.street, number: a.number, complement: a.complement, district: a.district, cep: a.cep, city: a.city || "Francisco Morato – SP", reference: a.reference };
    Object.keys(values).forEach(function (k) {
      if (form.elements[k] && values[k] !== undefined && values[k] !== null) form.elements[k].value = values[k];
    });
  }

  // ---------- abas ----------
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

  $("#suPassword").addEventListener("input", function (e) {
    var pw = e.target.value, score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    var colors = ["var(--danger)", "var(--danger)", "var(--sun)", "var(--moss)", "var(--forest)"];
    $("#pwBar").style.width = (score / 4 * 100) + "%";
    $("#pwBar").style.background = colors[score];
  });

  // ---------- entrar ----------
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    var f = new FormData(form);
    busy($("button[type=submit]", form), "Entrando…", async function () {
      try {
        await API.login(String(f.get("email") || ""), String(f.get("password") || ""));
        form.reset();
        await render();
      } catch (err) {
        showMsg(form, err.message);
        $("#loginPassword").value = "";
      }
    });
  });

  // ---------- criar conta ----------
  $("#signupForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    var f = new FormData(form);
    if (f.get("password") !== f.get("password2")) { showMsg(form, "As senhas não são iguais."); return; }
    if (!f.get("consent")) { showMsg(form, "Precisamos da sua autorização para usar os dados no atendimento."); return; }
    busy($("button[type=submit]", form), "Criando sua conta…", async function () {
      try {
        var profile = profileFrom(form);
        var res = await API.register(profile, String(f.get("password")));
        form.reset();
        if (res.needsConfirmation) {
          selectTab(0);
          $("#loginEmail").value = profile.email;
          showMsg($("#loginForm"), "Conta criada! Enviamos um link de confirmação para " + profile.email + ". Confirme e depois entre aqui.", "ok");
          return;
        }
        toast("Conta criada! 🐾");
        await render();
      } catch (err) {
        showMsg(form, err.message);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ---------- esqueci a senha ----------
  $("#forgotBtn").addEventListener("click", function () {
    $("#forgotEmail").value = $("#loginEmail").value;
    show("forgotView");
  });
  $$("[data-back]").forEach(function (b) { b.addEventListener("click", function () { show("authView"); }); });
  $("#forgotView").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    busy($("button[type=submit]", form), "Enviando…", async function () {
      try {
        await API.requestPasswordReset(form.elements.email.value);
        showMsg(form, "Se existir uma conta com esse e-mail, o link chega em alguns minutos. Confira também o spam.", "ok");
      } catch (err) { showMsg(form, err.message); }
    });
  });

  // ---------- nova senha ----------
  $("#recoveryView").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    if (form.elements.password.value !== form.elements.password2.value) { showMsg(form, "As senhas não são iguais."); return; }
    busy($("button[type=submit]", form), "Salvando…", async function () {
      try {
        await API.updatePassword(form.elements.password.value);
        history.replaceState(null, "", window.location.pathname + window.location.search);
        toast("Senha alterada!");
        await render();
      } catch (err) { showMsg(form, err.message); }
    });
  });

  // ---------- completar cadastro ----------
  $("#completeView").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    busy($("button[type=submit]", form), "Salvando…", async function () {
      try {
        await API.saveProfile(profileFrom(form));
        toast("Cadastro salvo! 🐾");
        await render();
      } catch (err) { showMsg(form, err.message); }
    });
  });

  // ---------- minha conta ----------
  var unsubscribe = null;

  async function renderRequests() {
    var list = $("#ordersList");
    var requests;
    try { requests = await API.myRequests(); }
    catch (err) { list.textContent = err.message; return; }
    list.innerHTML = "";
    if (!requests.length) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Você ainda não fez solicitações.";
      list.appendChild(empty);
      return;
    }
    requests.forEach(function (r) {
      var row = document.createElement("article");
      row.className = "order-row";
      var top = document.createElement("div");
      top.className = "top";
      var code = document.createElement("b");
      code.className = "order-code";
      code.textContent = r.code;
      var status = document.createElement("span");
      status.className = "status " + r.status;
      status.textContent = r.statusLabel;
      top.appendChild(code);
      top.appendChild(status);

      var info = document.createElement("small");
      var store = API.storeById(r.storeId);
      info.textContent = dateFmt.format(r.createdAt) + " · " + r.kind + " · " + (store ? store.name : "") + " · " + (r.delivery === "entrega" ? "Entrega" : "Retirada");
      row.appendChild(top);
      row.appendChild(info);

      var parts = [];
      if (r.items && r.items.length) parts.push(r.items.map(function (i) { return i.qty + "× " + i.name; }).join(", ") + " · " + money.format(r.total));
      if (r.message) parts.push("“" + r.message.slice(0, 140) + (r.message.length > 140 ? "…" : "") + "”");
      if (parts.length) {
        var detail = document.createElement("p");
        detail.className = "order-detail";
        detail.textContent = parts.join(" — ");
        row.appendChild(detail);
      }
      if (r.statusChangedAt && r.status !== "pendente") {
        var upd = document.createElement("small");
        upd.textContent = "Atualizado em " + dateFmt.format(r.statusChangedAt);
        row.appendChild(upd);
      }
      list.appendChild(row);
    });
  }

  $("#profileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    clearMsg(form);
    busy($("button[type=submit]", form), "Salvando…", async function () {
      try {
        await API.saveProfile(profileFrom(form));
        showMsg(form, "Dados atualizados.", "ok");
      } catch (err) { showMsg(form, err.message); }
    });
  });

  $$("[data-logout]").forEach(function (b) {
    b.addEventListener("click", async function () {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      await API.logout();
      toast("Você saiu da sua conta.");
      await render();
    });
  });

  // ---------- qual tela mostrar ----------
  async function render() {
    if (API.isRecoveryLink()) { show("recoveryView"); return; }
    var me = null;
    try { me = await API.currentUser(); } catch (err) { me = null; }

    if (!me) { show("authView"); return; }

    if (!me.profile) {
      var form = $("#completeView");
      $("#completeTitle").textContent = "Complete seu cadastro";
      $("#completeLead").textContent = "Precisamos dos seus dados de contato e entrega.";
      if (me.email) form.elements.email.value = me.email;
      show("completeView");
      return;
    }

    if (next) { window.location.href = "solicitacao.html"; return; }

    $("#helloName").textContent = "Olá, " + API.firstName(me.profile.name) + "! 🐾";
    fillProfile($("#profileForm"), me.profile);
    show("accountView");
    await renderRequests();
    if (!unsubscribe) unsubscribe = API.subscribe(function () { if (!$("#accountView").hidden) renderRequests(); });
    if (window.location.hash === "#dados") $("#dados").scrollIntoView({ behavior: "smooth" });
  }

  render();
})();
