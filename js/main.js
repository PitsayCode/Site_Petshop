// Pet Tem Home — comportamento da página inicial
// Menu interativo, catálogo com fotos 3D, sacola, checkout e mapa.
// A vitrine 3D e a visualização rápida ficam em js/produto3d.js.

(function () {
  "use strict";

  var CFG = window.PET_CONFIG;
  var API = window.PetAPI;
  var PRODUCTS = window.PET_PRODUCTS;
  var CATS = window.PET_CATEGORIES;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function productById(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }
  function catLabel(id) { return (CATS.filter(function (c) { return c.id === id; })[0] || {}).label || ""; }
  function thumb(img) { if (window.PetThumbs) window.PetThumbs.observe(img); }
  function variantIndex(p, label) {
    var list = (p.model && p.model.variants) || [];
    for (var i = 0; i < list.length; i++) if (list[i].label === label) return i;
    return 0;
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // =============== Header: sombra ao rolar ===============
  var header = $("#siteHeader");
  function onScroll() { header.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // =============== Menu: indicador deslizante + scroll spy ===============
  var nav = $("#primaryNav");
  var indicator = $("#navIndicator");
  var navItems = $$("[data-nav]", nav);
  var activeItem = null;

  function moveIndicator(target) {
    if (!target) { indicator.style.opacity = "0"; return; }
    var navBox = nav.getBoundingClientRect();
    var box = target.getBoundingClientRect();
    indicator.style.left = (box.left - navBox.left) + "px";
    indicator.style.width = box.width + "px";
    indicator.style.opacity = "1";
  }
  navItems.forEach(function (item) {
    item.addEventListener("mouseenter", function () { moveIndicator(item); });
  });
  nav.addEventListener("mouseleave", function () { moveIndicator(activeItem); });
  window.addEventListener("resize", function () { moveIndicator(activeItem); });

  if (window.IntersectionObserver) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        activeItem = navItems.filter(function (n) { return n.getAttribute("data-nav") === id; })[0] || null;
        navItems.forEach(function (n) { n.classList.toggle("active", n === activeItem); });
        moveIndicator(activeItem);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["top", "sobre", "produtos", "vitrine", "pedido", "lojas"].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  // =============== Mega menu de produtos ===============
  var megaWrap = $("#megaWrap");
  var megaToggle = $("#megaToggle");
  var megaMenu = $("#megaMenu");
  var megaTimer;

  CATS.filter(function (c) { return c.id !== "todos"; }).forEach(function (c) {
    var count = PRODUCTS.filter(function (p) { return p.cat === c.id; }).length;
    var img = el("img", { alt: "", "data-product": c.cover });
    var link = el("a", { href: "#produtos", role: "menuitem", "data-cat": c.id }, [
      el("span", { class: "m-emoji" }, [img]),
      el("div", {}, [el("b", { text: c.label }), el("span", { text: count + (count === 1 ? " produto" : " produtos") })])
    ]);
    megaMenu.appendChild(link);
  });

  function setMega(open) {
    megaWrap.classList.toggle("open", open);
    megaToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) $$("img[data-product]", megaMenu).forEach(function (img) { if (!img.src && window.PetThumbs) window.PetThumbs.load(img); });
  }
  megaToggle.addEventListener("click", function () { setMega(!megaWrap.classList.contains("open")); });
  megaWrap.addEventListener("mouseenter", function () { clearTimeout(megaTimer); setMega(true); });
  megaWrap.addEventListener("mouseleave", function () { megaTimer = setTimeout(function () { setMega(false); }, 180); });
  megaMenu.addEventListener("click", function (e) {
    var link = e.target.closest("[data-cat]");
    if (!link) return;
    setFilter(link.getAttribute("data-cat"));
    setMega(false);
  });
  document.addEventListener("click", function (e) {
    if (!megaWrap.contains(e.target)) setMega(false);
  });

  // =============== Menu mobile ===============
  var mobileMenu = $("#mobileMenu");
  var menuToggle = $("#menuToggle");
  function setMobile(open) {
    mobileMenu.classList.toggle("open", open);
    mobileMenu.setAttribute("aria-hidden", open ? "false" : "true");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("no-scroll", open || cartDrawer.classList.contains("open"));
    if (open) $("#mobileClose").focus();
  }
  menuToggle.addEventListener("click", function () { setMobile(true); });
  $("#mobileClose").addEventListener("click", function () { setMobile(false); });
  $("[data-close-menu]").addEventListener("click", function () { setMobile(false); });
  $$("nav a", mobileMenu).forEach(function (a) { a.addEventListener("click", function () { setMobile(false); }); });

  var mobileCats = $("#mobileCats");
  CATS.filter(function (c) { return c.id !== "todos"; }).forEach(function (c) {
    var b = el("button", { type: "button", text: c.emoji + " " + c.label });
    b.addEventListener("click", function () {
      setFilter(c.id);
      setMobile(false);
      document.getElementById("produtos").scrollIntoView({ behavior: "smooth" });
    });
    mobileCats.appendChild(b);
  });

  // =============== Folhas caindo no hero ===============
  var leaves = $("#leaves");
  if (leaves && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var glyphs = ["🍃", "🍂", "🌿", "🍃"];
    for (var i = 0; i < 9; i++) {
      var s = el("span", { text: glyphs[i % glyphs.length] });
      s.style.left = (Math.random() * 95) + "%";
      s.style.animationDuration = (12 + Math.random() * 10) + "s";
      s.style.animationDelay = (-Math.random() * 20) + "s";
      s.style.fontSize = (14 + Math.random() * 12) + "px";
      leaves.appendChild(s);
    }
  }

  // =============== Revelar ao rolar ===============
  if (window.IntersectionObserver) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    $$(".reveal").forEach(function (n) { revealer.observe(n); });
  } else {
    $$(".reveal").forEach(function (n) { n.classList.add("in"); });
  }

  // =============== Catálogo ===============
  var grid = $("#productGrid");
  var tiles = $("#catTiles");
  var search = $("#searchInput");
  var sortSelect = $("#sortSelect");
  var resultCount = $("#resultCount");
  var filter = { cat: "todos", q: "", sort: "relevancia" };

  CATS.forEach(function (c) {
    var count = c.id === "todos" ? PRODUCTS.length : PRODUCTS.filter(function (p) { return p.cat === c.id; }).length;
    var img = el("img", { alt: "", "data-product": c.cover });
    var tile = el("button", { type: "button", class: "cat-tile", "data-cat": c.id, "aria-pressed": "false" }, [
      el("span", { class: "cat-media" }, [img]),
      el("span", { class: "cat-name", text: c.label }),
      el("span", { class: "cat-count", text: count + (count === 1 ? " item" : " itens") })
    ]);
    tile.addEventListener("click", function () { setFilter(c.id); });
    tiles.appendChild(tile);
    thumb(img);
  });

  function normalize(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function setFilter(cat) {
    filter.cat = cat;
    $$(".cat-tile", tiles).forEach(function (t) {
      t.setAttribute("aria-pressed", t.getAttribute("data-cat") === cat ? "true" : "false");
    });
    renderProducts();
  }

  search.addEventListener("input", function () { filter.q = search.value; renderProducts(); });
  sortSelect.addEventListener("change", function () { filter.sort = sortSelect.value; renderProducts(); });

  var ICON_3D = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>';

  function renderProducts() {
    var q = normalize(filter.q.trim());
    var list = PRODUCTS.filter(function (p) {
      return (filter.cat === "todos" || p.cat === filter.cat) &&
        (!q || normalize(p.name + " " + p.desc + " " + (p.specs || []).join(" ")).indexOf(q) !== -1);
    });
    if (filter.sort === "menor") list.sort(function (a, b) { return a.price - b.price; });
    if (filter.sort === "maior") list.sort(function (a, b) { return b.price - a.price; });
    if (filter.sort === "nome") list.sort(function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); });

    resultCount.textContent = list.length + (list.length === 1 ? " produto" : " produtos") +
      (filter.cat !== "todos" ? " em " + catLabel(filter.cat) : "");
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("div", { class: "empty", text: "Nada encontrado por aqui 🐾 Tente outra busca ou fale com a loja no WhatsApp." }));
      return;
    }

    list.forEach(function (p, idx) {
      var img = el("img", { alt: p.name });
      img.setAttribute("data-product", p.id);
      var cta = el("span", { class: "media-cta" });
      cta.innerHTML = ICON_3D;
      cta.appendChild(document.createTextNode("Girar em 3D"));
      var media = el("button", { type: "button", class: "product-media tone-" + p.tone, "aria-label": "Ver " + p.name + " em 3D" }, [img, cta]);
      media.addEventListener("click", function () {
        if (window.PetQuickView) window.PetQuickView.open(p.id, 0);
      });

      var variants = (p.model && p.model.variants) || [];
      var dots = null;
      if (variants.length > 1) {
        dots = el("span", { class: "variant-dots", title: variants.length + " cores" });
        variants.forEach(function (v) {
          var d = el("i");
          d.style.background = v.swatch;
          dots.appendChild(d);
        });
      }

      var add = el("button", { type: "button", class: "add-btn", "aria-label": "Adicionar " + p.name + " à sacola" });
      add.innerHTML = '<svg aria-hidden="true"><use href="#i-bag"/></svg><span class="label">Adicionar</span>';
      add.addEventListener("click", function () { addToCart(p.id, 1, variants[0] ? variants[0].label : null, add); });

      var card = el("article", { class: "product-card" }, [
        el("div", { class: "media-wrap" }, [media, p.badge ? el("span", { class: "product-badge", text: p.badge }) : null]),
        el("div", { class: "product-body" }, [
          el("div", { class: "product-meta" }, [el("span", { class: "product-cat", text: catLabel(p.cat) }), dots]),
          el("h3", { text: p.name }),
          el("ul", { class: "spec-chips" }, (p.specs || []).slice(0, 2).map(function (s) { return el("li", { text: s }); })),
          el("div", { class: "product-foot" }, [el("span", { class: "price", text: money.format(p.price) }), add])
        ])
      ]);
      card.style.animationDelay = Math.min(idx * 45, 450) + "ms";
      grid.appendChild(card);
      thumb(img);
    });
  }
  setFilter("todos");

  // =============== Sacola ===============
  var cartDrawer = $("#cartDrawer");
  var cartBody = $("#cartBody");
  var cartFoot = $("#cartFoot");
  var cartCount = $("#cartCount");
  var orderDone = null;

  function keyOf(item) { return item.id + "|" + (item.variant || ""); }

  function cartItems() {
    return API.cart.get().map(function (i) {
      var p = productById(i.id);
      return p ? Object.assign({}, p, { qty: i.qty, variant: i.variant || null, key: keyOf(i) }) : null;
    }).filter(Boolean);
  }

  function addToCart(id, qty, variant, button) {
    var items = API.cart.get();
    var key = id + "|" + (variant || "");
    var found = items.filter(function (i) { return keyOf(i) === key; })[0];
    if (found) found.qty = Math.min(found.qty + (qty || 1), 20);
    else items.push({ id: id, qty: Math.min(qty || 1, 20), variant: variant || null });
    API.cart.set(items);
    orderDone = null;
    updateBadge(true);
    var p = productById(id);
    toast((p ? p.name : "Produto") + (variant ? " · " + variant : "") + " na sacola 🐾");
    if (button) {
      button.classList.add("added");
      setTimeout(function () { button.classList.remove("added"); }, 900);
    }
  }

  function changeQty(key, delta) {
    var items = API.cart.get().map(function (i) {
      if (keyOf(i) === key) i.qty = Math.min(20, i.qty + delta);
      return i;
    }).filter(function (i) { return i.qty > 0; });
    API.cart.set(items);
    updateBadge();
    renderCart();
  }

  function updateBadge(bump) {
    var n = API.cart.get().reduce(function (s, i) { return s + i.qty; }, 0);
    cartCount.textContent = String(n);
    cartCount.hidden = n === 0;
    if (bump) {
      cartCount.classList.remove("bump");
      void cartCount.offsetWidth;
      cartCount.classList.add("bump");
    }
  }

  function setCart(open) {
    cartDrawer.classList.toggle("open", open);
    cartDrawer.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("no-scroll", open);
    if (open) renderCart();
  }
  $("#cartBtn").addEventListener("click", function () { setCart(true); });
  $$("[data-close-cart]").forEach(function (b) { b.addEventListener("click", function () { setCart(false); }); });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var qv = document.getElementById("quickView");
    if (qv && !qv.hidden) return;
    setMega(false);
    setMobile(false);
    setCart(false);
  });

  function radioGroup(name, options, checked) {
    var box = el("div", { class: "segmented", role: "radiogroup" });
    options.forEach(function (o, idx) {
      var id = name + "_" + idx;
      var input = el("input", { type: "radio", name: name, id: id, value: o.value });
      if (o.value === checked) input.checked = true;
      box.appendChild(input);
      box.appendChild(el("label", { for: id, text: o.label }));
    });
    return box;
  }

  async function renderCart() {
    cartBody.innerHTML = "";
    cartFoot.innerHTML = "";

    if (orderDone) {
      var wa = "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent("Olá! Fiz o pedido " + orderDone.code + " pelo site 🐾");
      cartBody.appendChild(el("div", { class: "cart-empty" }, [
        el("i", { text: "🎉" }),
        el("h3", { text: "Pedido enviado!" }),
        el("p", { text: "Código " + orderDone.code + ". A comanda já chegou ao painel da " + orderDone.store + ". Acompanhe o status em Minha conta." })
      ]));
      cartFoot.appendChild(el("div", { style: "display:grid;gap:10px;" }, [
        el("a", { class: "btn btn-primary btn-block", href: "login.html", text: "Acompanhar pedido" }),
        el("a", { class: "btn btn-ghost btn-block", href: wa, target: "_blank", rel: "noopener", text: "Avisar a loja no WhatsApp" })
      ]));
      return;
    }

    var items = cartItems();
    if (!items.length) {
      cartBody.appendChild(el("div", { class: "cart-empty" }, [
        el("i", { text: "🧺" }), el("h3", { text: "Sua sacola está vazia" }),
        el("p", { text: "Que tal um petisco para o seu melhor amigo?" })
      ]));
      var go = el("a", { class: "btn btn-primary btn-block", href: "#produtos", text: "Ver produtos" });
      go.addEventListener("click", function () { setCart(false); });
      cartFoot.appendChild(go);
      return;
    }

    items.forEach(function (p) {
      var minus = el("button", { type: "button", "aria-label": "Diminuir", text: "−" });
      var plus = el("button", { type: "button", "aria-label": "Aumentar", text: "+" });
      minus.addEventListener("click", function () { changeQty(p.key, -1); });
      plus.addEventListener("click", function () { changeQty(p.key, 1); });
      var img = el("img", { alt: "" });
      img.setAttribute("data-product", p.id);
      img.setAttribute("data-variant", String(variantIndex(p, p.variant)));
      cartBody.appendChild(el("div", { class: "cart-item" }, [
        el("div", { class: "ci-media tone-" + p.tone, "aria-hidden": "true" }, [img]),
        el("div", { class: "ci-info" }, [
          el("b", { text: p.name }),
          p.variant ? el("small", { text: "Cor: " + p.variant }) : null,
          el("small", { text: money.format(p.price * p.qty) })
        ]),
        el("div", { class: "qty" }, [minus, el("span", { text: String(p.qty) }), plus])
      ]));
      if (window.PetThumbs) window.PetThumbs.load(img);
    });

    var me = await API.currentUser();
    var total = items.reduce(function (s, p) { return s + p.price * p.qty; }, 0);

    var form = el("form", { id: "checkoutForm", novalidate: "" });
    var storeSelect = el("select", { id: "storeSelect", name: "store" });
    CFG.stores.forEach(function (s) {
      storeSelect.appendChild(el("option", { value: s.id, text: s.name + " – " + s.district }));
    });
    var msg = el("div", { class: "form-msg", id: "checkoutMsg", role: "alert" });

    form.appendChild(el("div", { style: "margin-top:18px;" }, [
      el("div", { class: "field" }, [el("label", { for: "storeSelect", text: "Loja que vai atender" }), storeSelect]),
      el("div", { class: "field" }, [el("span", { class: "label", text: "Como prefere receber?" }),
        radioGroup("delivery", [{ value: "entrega", label: "🛵 Entrega" }, { value: "retirada", label: "🏪 Retirar na loja" }], "entrega")]),
      el("div", { class: "field" }, [el("span", { class: "label", text: "Pagamento (na entrega ou retirada)" }),
        radioGroup("payment", [{ value: "Pix", label: "Pix" }, { value: "Cartão", label: "Cartão" }, { value: "Dinheiro", label: "Dinheiro" }], "Pix")]),
      el("div", { class: "field" }, [el("label", { for: "orderNotes", text: "Observações (opcional)" }),
        el("textarea", { id: "orderNotes", name: "notes", maxlength: "400", placeholder: "Ex.: tocar a campainha, precisa de troco…" })])
    ]));
    cartBody.appendChild(form);

    var who = me
      ? "Entregando para " + API.firstName(me.profile.name) + " · endereço da sua conta."
      : "Você vai entrar na sua conta para concluir.";
    var btn = el("button", { type: "submit", form: "checkoutForm", class: "btn btn-primary btn-block", id: "checkoutBtn", text: me ? "Finalizar pedido" : "Entrar e finalizar" });
    cartFoot.appendChild(msg);
    cartFoot.appendChild(el("div", { class: "total-row" }, [el("span", { text: "Total" }), el("b", { text: money.format(total) })]));
    cartFoot.appendChild(btn);
    var note = el("p", { class: "secure-note" });
    note.innerHTML = '<svg aria-hidden="true"><use href="#i-lock"/></svg>';
    note.appendChild(document.createTextNode(who + " Seus dados vão criptografados só para a loja."));
    cartFoot.appendChild(note);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      msg.className = "form-msg";
      if (!me) {
        sessionStorage.setItem("ptm_next", "checkout");
        window.location.href = "login.html?next=checkout";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Lacrando e enviando…";
      try {
        var data = new FormData(form);
        orderDone = await API.placeOrder({
          items: items.map(function (p) {
            return { name: p.name + (p.variant ? " – " + p.variant : ""), qty: p.qty, price: p.price };
          }),
          storeId: data.get("store"),
          deliveryType: data.get("delivery"),
          payment: data.get("payment"),
          notes: data.get("notes")
        });
        API.cart.clear();
        updateBadge();
        renderCart();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "form-msg error show";
        btn.disabled = false;
        btn.textContent = "Finalizar pedido";
        if (err.code === "AUTH") window.location.href = "login.html?next=checkout";
      }
    });
  }

  updateBadge();
  API.onChange(function () { updateBadge(); });

  window.PetShop = { addToCart: addToCart, setFilter: setFilter };

  if (window.location.hash === "#sacola" || sessionStorage.getItem("ptm_open_cart") === "1") {
    sessionStorage.removeItem("ptm_open_cart");
    setCart(true);
  }

  // =============== Conta no header ===============
  API.currentUser().then(function (me) {
    if (!me) return;
    $("#accountLabel").textContent = "Olá, " + API.firstName(me.profile.name);
    $("#accountBtn").setAttribute("aria-label", "Minha conta");
  });

  // O mapa e a lista de lojas ficam em js/mapa.js
})();
