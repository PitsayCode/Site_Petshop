// Pet Tem Home — vitrine 3D, fotos dos produtos e visualização rápida
// Usa o motor em js/3d/core.js. Carregue este arquivo ANTES de js/main.js.

(function () {
  "use strict";

  var P = window.Pet3D;
  var PRODUCTS = window.PET_PRODUCTS || [];
  var CATS = window.PET_CATEGORIES || [];
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var has3D = !!(P && P.supported);

  function byId(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }
  function catLabel(id) { return (CATS.filter(function (c) { return c.id === id; })[0] || {}).label || ""; }
  function variantLabel(p, i) {
    var v = p && p.model && p.model.variants && p.model.variants[i || 0];
    return v ? v.label : null;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function addToCart(p, qty, variant, button) {
    if (window.PetShop) window.PetShop.addToCart(p.id, qty, variantLabel(p, variant), button);
  }

  // ================= fotos 3D dos produtos =================
  function fallback(img, p) {
    var span = el("span", "thumb-emoji", p ? p.emoji : "🐾");
    span.setAttribute("aria-hidden", "true");
    var holder = img.parentNode;
    img.replaceWith(span);
    if (holder) holder.classList.add("loaded");
  }

  function loadThumb(img) {
    var p = byId(img.getAttribute("data-product"));
    if (!p) return;
    if (!has3D) { fallback(img, p); return; }
    P.renderThumb(p, Number(img.getAttribute("data-variant") || 0)).then(function (url) {
      if (!url) { fallback(img, p); return; }
      img.onload = function () {
        img.classList.add("ready");
        if (img.parentNode) img.parentNode.classList.add("loaded");
      };
      img.src = url;
    });
  }

  var thumbObserver = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      thumbObserver.unobserve(e.target);
      loadThumb(e.target);
    });
  }, { rootMargin: "500px 0px" }) : null;

  window.PetThumbs = {
    observe: function (img) { if (thumbObserver) thumbObserver.observe(img); else loadThumb(img); },
    load: loadThumb
  };
  Array.prototype.forEach.call(document.querySelectorAll("img[data-product]"), window.PetThumbs.observe);

  // ================= partes compartilhadas =================
  function mountViewer(stage) {
    if (!has3D) {
      stage.classList.add("no3d");
      return null;
    }
    try {
      return new P.Viewer(stage, { autoRotate: true });
    } catch (e) {
      stage.classList.add("no3d");
      return null;
    }
  }

  function showIn(viewer, stage, p, variant) {
    if (!viewer) {
      var old = $(".stage-fallback", stage);
      if (old) old.remove();
      var fb = el("div", "stage-fallback");
      fb.appendChild(el("span", "thumb-emoji", p.emoji));
      fb.appendChild(el("p", "", "Seu navegador não exibe 3D, mas o produto está disponível."));
      stage.appendChild(fb);
      return;
    }
    stage.classList.add("loading");
    P.fontsReady.then(function () {
      viewer.show(p, variant);
      stage.classList.remove("loading");
    });
  }

  function renderSpecs(list, p) {
    list.innerHTML = "";
    (p.specs || []).forEach(function (s) { list.appendChild(el("li", "", s)); });
  }

  function renderSwatches(box, p, current, onPick) {
    box.innerHTML = "";
    var variants = (p.model && p.model.variants) || [];
    box.hidden = variants.length < 2;
    if (box.hidden) return;
    var label = el("span", "swatch-label", "Cor: " + variants[current].label);
    var row = el("div", "swatch-row");
    variants.forEach(function (v, i) {
      var b = el("button", "swatch");
      b.type = "button";
      b.style.setProperty("--sw", v.swatch);
      b.title = v.label;
      b.setAttribute("aria-label", v.label);
      b.setAttribute("aria-pressed", i === current ? "true" : "false");
      b.addEventListener("click", function () { onPick(i); });
      row.appendChild(b);
    });
    box.appendChild(label);
    box.appendChild(row);
  }

  function fullscreen(target) {
    var doc = document;
    if (doc.fullscreenElement) { doc.exitFullscreen(); return; }
    if (target.requestFullscreen) target.requestFullscreen().catch(function () {});
  }

  // ================= vitrine (seção #vitrine) =================
  (function showcase() {
    var stage = $("#stage3d");
    var rail = $("#modelList");
    if (!stage || !rail) return;
    var featured = (window.PET_FEATURED || []).map(byId).filter(Boolean);
    if (!featured.length) featured = PRODUCTS.slice(0, 6);
    var state = { p: null, variant: 0, viewer: null };

    featured.forEach(function (p) {
      var b = el("button", "model-btn");
      b.type = "button";
      b.setAttribute("data-id", p.id);
      b.setAttribute("aria-pressed", "false");
      var media = el("span", "model-thumb");
      var img = el("img");
      img.alt = "";
      img.setAttribute("data-product", p.id);
      media.appendChild(img);
      var text = el("span", "model-text");
      text.appendChild(el("b", "", p.name));
      text.appendChild(el("span", "", money.format(p.price)));
      b.appendChild(media);
      b.appendChild(text);
      b.addEventListener("click", function () { select(p, 0); });
      rail.appendChild(b);
      window.PetThumbs.observe(img);
    });

    function select(p, variant) {
      state.p = p;
      state.variant = variant || 0;
      Array.prototype.forEach.call(rail.children, function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-id") === p.id ? "true" : "false");
      });
      $("#modelCat").textContent = catLabel(p.cat);
      $("#modelName").textContent = p.name;
      $("#modelDesc").textContent = p.desc;
      $("#modelPrice").textContent = money.format(p.price);
      renderSpecs($("#modelSpecs"), p);
      renderSwatches($("#modelSwatches"), p, state.variant, function (i) { select(p, i); });
      if (!state.viewer) state.viewer = mountViewer(stage);
      showIn(state.viewer, stage, p, state.variant);
    }

    $("#modelAdd").addEventListener("click", function () {
      if (state.p) addToCart(state.p, 1, state.variant, this);
    });
    $("#modelDetails").addEventListener("click", function () {
      if (state.p && window.PetQuickView) window.PetQuickView.open(state.p.id, state.variant);
    });
    var reset = $("#stageReset");
    if (reset) reset.addEventListener("click", function () { if (state.viewer) state.viewer.reset(); });
    var full = $("#stageFull");
    if (full) full.addEventListener("click", function () { fullscreen(stage); });

    var started = false;
    function start() {
      if (started) return;
      started = true;
      select(featured[0], 0);
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { start(); obs.disconnect(); }
      }, { rootMargin: "400px 0px" }).observe(stage);
    } else {
      start();
    }
    window.PetShowcase = { select: function (id) { var p = byId(id); if (p) select(p, 0); }, start: start };
  })();

  // ================= visualização rápida (modal) =================
  (function quickView() {
    var modal = $("#quickView");
    if (!modal) return;
    var stage = $("#qvStage");
    var viewer = null;
    var state = { p: null, variant: 0, qty: 1 };
    var lastFocus = null;

    function paintQty() {
      $("#qvQty").textContent = String(state.qty);
      $("#qvTotal").textContent = money.format(state.p.price * state.qty);
    }

    function pick(i) {
      state.variant = i;
      renderSwatches($("#qvSwatches"), state.p, i, pick);
      showIn(viewer, stage, state.p, i);
    }

    function open(id, variant) {
      var p = byId(id);
      if (!p) return;
      state = { p: p, variant: variant || 0, qty: 1 };
      lastFocus = document.activeElement;
      $("#qvCat").textContent = catLabel(p.cat);
      $("#qvName").textContent = p.name;
      $("#qvPrice").textContent = money.format(p.price);
      $("#qvDesc").textContent = p.desc;
      renderSpecs($("#qvSpecs"), p);
      renderSwatches($("#qvSwatches"), p, state.variant, pick);
      paintQty();
      var cfg = window.PET_CONFIG || {};
      $("#qvWhats").href = "https://wa.me/" + (cfg.whatsapp || "") + "?text=" + encodeURIComponent("Olá! Tenho interesse no produto: " + p.name);

      modal.hidden = false;
      document.body.classList.add("no-scroll");
      setTimeout(function () { modal.classList.add("open"); }, 20);
      if (!viewer) viewer = mountViewer(stage);
      if (viewer) viewer.resize();
      showIn(viewer, stage, p, state.variant);
      $("#qvClose").focus();
    }

    function close() {
      if (modal.hidden) return;
      modal.classList.remove("open");
      setTimeout(function () {
        modal.hidden = true;
        var cart = document.getElementById("cartDrawer");
        if (!cart || !cart.classList.contains("open")) document.body.classList.remove("no-scroll");
      }, 260);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    $("#qvMinus").addEventListener("click", function () { state.qty = Math.max(1, state.qty - 1); paintQty(); });
    $("#qvPlus").addEventListener("click", function () { state.qty = Math.min(20, state.qty + 1); paintQty(); });
    $("#qvAdd").addEventListener("click", function () {
      addToCart(state.p, state.qty, state.variant, this);
      close();
    });
    Array.prototype.forEach.call(modal.querySelectorAll("[data-close-qv]"), function (b) {
      b.addEventListener("click", close);
    });
    var qvReset = $("#qvReset");
    if (qvReset) qvReset.addEventListener("click", function () { if (viewer) viewer.reset(); });

    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      var items = Array.prototype.filter.call(
        modal.querySelectorAll("button, a[href], input, [tabindex]:not([tabindex='-1'])"),
        function (n) { return !n.disabled && n.offsetParent !== null; }
      );
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.PetQuickView = { open: open, close: close };
  })();
})();
