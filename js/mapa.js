// Pet Tem Home — mapa das lojas (Leaflet + OpenStreetMap)
//
// - Marcadores com a ponta exatamente sobre a loja
// - Lista e mapa sincronizados (clicar em um destaca o outro)
// - "Loja mais perto de mim": usa a localização só dentro do navegador
// - Rotas pelo endereço no Google Maps e no Waze
// - Não "prende" a rolagem da página: Ctrl + rolagem (computador)
//   ou dois dedos (celular) para mover o mapa

(function () {
  "use strict";

  var CFG = window.PET_CONFIG;
  var mapEl = document.getElementById("map");
  var listEl = document.getElementById("storeList");
  if (!mapEl || !listEl || !CFG) return;

  var stores = CFG.stores;
  var statusEl = document.getElementById("mapStatus");
  var gestureEl = document.getElementById("mapGesture");
  var locateBtn = document.getElementById("mapLocate");
  var fitBtn = document.getElementById("mapFit");
  var nearestBtn = document.getElementById("nearestBtn");

  var map = null;
  var markers = {};
  var cards = {};
  var userLayer = null;
  var activeId = null;
  var touchDevice = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var km = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function hasPin(s) { return typeof s.lat === "number" && typeof s.lng === "number"; }
  function fullAddress(s) { return s.address + ", " + s.city; }
  function googleRoute(s) {
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(fullAddress(s));
  }
  function wazeRoute(s) {
    return hasPin(s)
      ? "https://waze.com/ul?ll=" + s.lat + "," + s.lng + "&navigate=yes"
      : "https://waze.com/ul?q=" + encodeURIComponent(fullAddress(s));
  }
  function whatsapp(s) {
    return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent("Olá! Tenho uma dúvida sobre a " + s.name + " (" + s.district + ").");
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function link(cls, href, text) {
    var a = el("a", cls, text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  var statusTimer;
  function status(msg, sticky) {
    if (!statusEl) return;
    clearTimeout(statusTimer);
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
    if (msg && !sticky) statusTimer = setTimeout(function () { statusEl.hidden = true; }, 4200);
  }

  var gestureTimer;
  function gestureHint(msg) {
    if (!gestureEl) return;
    gestureEl.textContent = msg;
    gestureEl.classList.add("show");
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(function () { gestureEl.classList.remove("show"); }, 1300);
  }

  function distanceKm(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ---------- lista de lojas ----------
  stores.forEach(function (s, i) {
    var card = el("article", "store-card");
    card.setAttribute("data-store", s.id);

    var pin = el("span", "store-num", String(i + 1));
    pin.setAttribute("aria-hidden", "true");

    var body = el("div", "store-body");
    var head = el("div", "store-head");
    head.appendChild(el("h3", "", s.name + " · " + s.district));
    var dist = el("span", "store-dist");
    dist.hidden = true;
    head.appendChild(dist);
    body.appendChild(head);
    body.appendChild(el("address", "", hasPin(s) ? fullAddress(s) : "Francisco Morato – SP · endereço a confirmar"));

    var actions = el("div", "store-actions");
    if (hasPin(s)) {
      var see = el("button", "store-link primary", "Ver no mapa");
      see.type = "button";
      see.addEventListener("click", function () { select(s.id, true); });
      actions.appendChild(see);
      actions.appendChild(link("store-link", googleRoute(s), "Google Maps ↗"));
      actions.appendChild(link("store-link", wazeRoute(s), "Waze ↗"));
    } else {
      actions.appendChild(link("store-link primary", whatsapp(s), "Perguntar endereço ↗"));
    }
    body.appendChild(actions);

    card.appendChild(pin);
    card.appendChild(body);
    listEl.appendChild(card);
    cards[s.id] = { card: card, dist: dist, store: s };
  });

  // ---------- mapa ----------
  function pinIcon(n, active) {
    return L.divIcon({
      className: "store-pin" + (active ? " is-active" : ""),
      html: '<svg viewBox="0 0 44 56" aria-hidden="true"><path d="M22 54s19-20.4 19-33A19 19 0 0 0 3 21c0 12.6 19 33 19 33Z"/><circle cx="22" cy="21" r="12"/></svg><b>' + n + "</b>",
      iconSize: [44, 56],
      iconAnchor: [22, 54],
      popupAnchor: [0, -50]
    });
  }

  function popupContent(s) {
    var box = el("div", "store-popup");
    box.appendChild(el("strong", "", s.name + " · " + s.district));
    box.appendChild(el("span", "", fullAddress(s)));
    var row = el("div", "store-popup-actions");
    row.appendChild(link("", googleRoute(s), "Google Maps ↗"));
    row.appendChild(link("", wazeRoute(s), "Waze ↗"));
    box.appendChild(row);
    return box;
  }

  function select(id, fly) {
    var s = cards[id] && cards[id].store;
    if (!s) return;
    activeId = id;
    Object.keys(cards).forEach(function (k) { cards[k].card.classList.toggle("active", k === id); });
    if (!map || !hasPin(s)) return;
    stores.forEach(function (st, i) {
      if (markers[st.id]) markers[st.id].setIcon(pinIcon(i + 1, st.id === id));
    });
    if (fly) {
      map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 16), { duration: 0.7 });
      map.once("moveend", function () { markers[id].openPopup(); });
    } else {
      markers[id].openPopup();
    }
  }

  function fitAll(extra) {
    if (!map) return;
    var pts = stores.filter(hasPin).map(function (s) { return [s.lat, s.lng]; });
    if (extra) pts.push(extra);
    if (pts.length === 1) map.setView(pts[0], 16);
    else map.fitBounds(pts, { padding: [70, 70], maxZoom: 16 });
  }

  function init() {
    if (map) return;
    if (!window.L) {
      mapEl.classList.add("map-failed");
      mapEl.appendChild(el("p", "map-error", "Não foi possível carregar o mapa. Use os botões de rota ao lado."));
      return;
    }

    map = L.map(mapEl, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: !touchDevice,
      tap: false,
      zoomSnap: 0.5
    });
    L.control.zoom({ position: "bottomright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(map);
    map.attributionControl.setPrefix(false);

    // Servidores de mapa em ordem de preferência. O OpenStreetMap às vezes
    // recusa o acesso (erro 403) e devolve o bloco de aviso COMO IMAGEM, então
    // testamos um bloco antes de montar o mapa e trocamos de servidor se preciso.
    var OSM_LINK = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    var PROVIDERS = [
      { id: "osm", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", probe: "https://tile.openstreetmap.org/13/3032/4641.png", maxZoom: 19, attribution: OSM_LINK },
      { id: "osm-de", url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", probe: "https://tile.openstreetmap.de/13/3032/4641.png", maxZoom: 18, attribution: OSM_LINK },
      { id: "carto", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", subdomains: "abcd", probe: "https://a.basemaps.cartocdn.com/rastertiles/voyager/13/3032/4641.png", maxZoom: 20, attribution: OSM_LINK + ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' }
    ];

    function probe(p) {
      return fetch(p.probe + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    }

    function tileFailure() {
      mapEl.classList.add("map-failed");
      var box = el("div", "map-error");
      box.appendChild(el("p", "", "Não foi possível carregar o mapa agora."));
      var pins = stores.filter(hasPin);
      box.appendChild(link("", "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(fullAddress(pins[0] || stores[0])), "Ver as lojas no Google Maps ↗"));
      mapEl.appendChild(box);
    }

    function useProvider(i) {
      if (i >= PROVIDERS.length) { tileFailure(); return; }
      var p = PROVIDERS[i];
      probe(p).then(function (ok) {
        if (!ok) { useProvider(i + 1); return; }
        var layer = L.tileLayer(p.url, {
          maxZoom: p.maxZoom,
          subdomains: p.subdomains || "abc",
          referrerPolicy: "strict-origin-when-cross-origin",
          attribution: p.attribution
        }).addTo(map);
        map.invalidateSize({ pan: false });
        if (i > 0) status("O servidor principal de mapas está indisponível; usando um alternativo.");

        // O servidor pode recusar só quando o mapa pede vários blocos de uma
        // vez — e devolve o aviso COMO IMAGEM. Por isso conferimos um bloco de
        // verdade já usado no mapa: se vier recusado, trocamos de servidor.
        var lastCheck = 0;
        layer.on("load", function () {
          if (Date.now() - lastCheck < 30000) return;
          lastCheck = Date.now();
          var img = mapEl.querySelector("img.leaflet-tile");
          if (!img || !img.src) return;
          fetch(img.src, { cache: "no-store" }).then(function (r) {
            if (r.ok) return;
            map.removeLayer(layer);
            useProvider(i + 1);
          }).catch(function () { /* offline: mantém o que já está na tela */ });
        });
      });
    }
    useProvider(0);

    stores.forEach(function (s, i) {
      if (!hasPin(s)) return;
      markers[s.id] = L.marker([s.lat, s.lng], { icon: pinIcon(i + 1, false), title: s.name, riseOnHover: true, keyboard: true })
        .addTo(map)
        .bindPopup(popupContent(s), { closeButton: true, autoPanPadding: [40, 40] })
        .on("click", function () { select(s.id, false); });
    });
    fitAll();

    // rolagem: só dá zoom com Ctrl (ou Cmd), senão a página rola normalmente
    mapEl.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        map.setZoomAround(map.mouseEventToLatLng(e), map.getZoom() + (e.deltaY < 0 ? 1 : -1));
      } else {
        gestureHint("Use Ctrl + rolagem para dar zoom no mapa");
      }
    }, { passive: false });

    // toque: um dedo rola a página, dois dedos movem o mapa
    if (touchDevice) {
      mapEl.addEventListener("touchstart", function (e) {
        if (e.touches.length >= 2) { map.dragging.enable(); gestureEl && gestureEl.classList.remove("show"); }
        else { map.dragging.disable(); gestureHint("Use dois dedos para mover o mapa"); }
      }, { passive: true });
      mapEl.addEventListener("touchend", function (e) {
        if (e.touches.length === 0) map.dragging.disable();
      }, { passive: true });
    }

    // o mapa precisa recalcular o tamanho quando a área muda (layout, rotação, animações)
    if (window.ResizeObserver) {
      var lastWidth = mapEl.clientWidth;
      new ResizeObserver(function () {
        map.invalidateSize({ pan: false });
        // se o mapa nasceu sem largura (layout ainda montando), enquadra as lojas de novo
        if (lastWidth === 0 && mapEl.clientWidth > 0 && !userLayer && !activeId) fitAll();
        lastWidth = mapEl.clientWidth;
      }).observe(mapEl);
    }
    var panel = mapEl.closest(".reveal");
    if (panel) panel.addEventListener("transitionend", function () { map.invalidateSize({ pan: false }); });
  }

  // ---------- localização do visitante ----------
  function locate() {
    if (!navigator.geolocation) {
      status("Seu navegador não permite localização. Escolha a loja na lista.");
      return;
    }
    init();
    [locateBtn, nearestBtn].forEach(function (b) { if (b) b.classList.add("busy"); });
    status("Procurando sua localização…", true);
    navigator.geolocation.getCurrentPosition(function (pos) {
      [locateBtn, nearestBtn].forEach(function (b) { if (b) b.classList.remove("busy"); });
      var me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      var ranked = stores.filter(hasPin).map(function (s) { return { s: s, d: distanceKm(me, s) }; })
        .sort(function (a, b) { return a.d - b.d; });
      if (!ranked.length) { status(""); return; }

      ranked.forEach(function (r, i) {
        var c = cards[r.s.id];
        c.dist.hidden = false;
        c.dist.textContent = (i === 0 ? "Mais perto · " : "") + km.format(r.d) + " km";
        c.dist.classList.toggle("nearest", i === 0);
        listEl.appendChild(c.card);
      });
      stores.filter(function (s) { return !hasPin(s); }).forEach(function (s) { listEl.appendChild(cards[s.id].card); });

      if (map) {
        if (userLayer) map.removeLayer(userLayer);
        userLayer = L.layerGroup([
          L.circle([me.lat, me.lng], { radius: Math.min(pos.coords.accuracy, 400), color: "#2F7F8F", weight: 1, fillOpacity: 0.12 }),
          L.marker([me.lat, me.lng], {
            icon: L.divIcon({ className: "me-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
            title: "Você está aqui", keyboard: false
          })
        ]).addTo(map);
        fitAll([me.lat, me.lng]);
      }
      var near = ranked[0];
      status("A loja mais perto é a " + near.s.name + " (" + near.s.district + "), a " + km.format(near.d) + " km.");
      select(near.s.id, false);
    }, function (err) {
      [locateBtn, nearestBtn].forEach(function (b) { if (b) b.classList.remove("busy"); });
      var msg = err.code === 1
        ? "Sem permissão de localização. Tudo bem: escolha a loja na lista."
        : "Não conseguimos achar sua localização agora. Tente de novo ou escolha na lista.";
      status(msg);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  if (fitBtn) fitBtn.addEventListener("click", function () {
    init();
    if (map) { map.closePopup(); fitAll(userLayer ? userLayer.getLayers()[0].getLatLng() : null); }
  });
  if (locateBtn) locateBtn.addEventListener("click", locate);
  if (nearestBtn) nearestBtn.addEventListener("click", locate);

  // carrega o mapa só quando a seção se aproxima da tela
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { init(); obs.disconnect(); }
    }, { rootMargin: "400px 0px" }).observe(mapEl);
  } else {
    init();
  }

  window.PetMap = { init: init, select: select, locate: locate, fitAll: fitAll };
})();
