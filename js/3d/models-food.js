// Pet Tem Home — modelos 3D: embalagens, comedouro, pote, bolinha e osso

(function () {
  "use strict";

  var P = window.Pet3D;
  if (!P) return;
  var K = P.K, THREE = K.THREE;

  // ---------- peças espalhadas (ração, sementes, flocos) ----------
  function scatter(geo, material, count, r, place) {
    var mesh = new THREE.InstancedMesh(geo, material, count);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    for (var i = 0; i < count; i++) {
      var info = place(i, r);
      p.set(info.x, info.y, info.z);
      e.set(info.rx !== undefined ? info.rx : r() * 6.28, r() * 6.28, info.rz !== undefined ? info.rz : r() * 6.28);
      q.setFromEuler(e);
      s.set(info.sx, info.sy, info.sz);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      if (info.color) { col.set(info.color); mesh.setColorAt(i, col); }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  function kibbleMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, bumpMap: K.T.noise(21, 3), bumpScale: 0.05 });
  }

  function kibblePile(group, o, r, cx, cz, R, count, lift) {
    var geo = new THREE.SphereGeometry(1, 14, 10);
    var base = o.kibbleColor || "#9A5B2E";
    group.add(scatter(geo, kibbleMaterial(), count, r, function () {
      var a = r() * Math.PI * 2, rr = Math.sqrt(r()) * R;
      var size = 0.05 + r() * 0.022;
      return {
        x: cx + Math.cos(a) * rr,
        y: (lift || 0) + (1 - Math.pow(rr / R, 2)) * R * 0.38 + size * 0.5,
        z: cz + Math.sin(a) * rr,
        sx: size, sy: size * 0.62, sz: size * 0.9,
        color: K.shade(base, (r() - 0.5) * 0.14)
      };
    }));
  }

  // ---------- rótulos ----------
  function labelFront(o, W, H, r) {
    var c = K.canvas(W, H), ctx = c.getContext("2d"), d = K.draw;
    var g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, o.colorTop);
    g.addColorStop(1, o.colorBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 40; i++) d.leaf(ctx, r() * W, r() * H, W * (0.015 + r() * 0.035), r() * 6.28, "rgba(255,255,255,0.055)");

    var ink = o.ink || "#FFFCF4";
    d.silhouette(ctx, "paw", W * 0.21, H * 0.078, W * 0.085, o.accent);
    d.text(ctx, "Pet Tem Home", W * 0.56, H * 0.095, "600 " + Math.round(W * 0.088) + "px Fredoka", ink);
    d.text(ctx, o.tagline || "NUTRIÇÃO COM CARINHO", W * 0.5, H * 0.14, "800 " + Math.round(W * 0.03) + "px Nunito", "rgba(255,252,244,0.82)", { spacing: Math.round(W * 0.008) + "px" });

    var cx = W / 2, cy = H * 0.41, R = W * 0.31;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    var sky = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sky.addColorStop(0, o.windowTop || "#FFF8E6");
    sky.addColorStop(1, o.windowBottom || "#EADFC0");
    ctx.fillStyle = sky;
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.fillStyle = "rgba(243,200,90,0.9)";
    ctx.beginPath(); ctx.arc(cx + R * 0.45, cy - R * 0.42, R * 0.17, 0, 7); ctx.fill();
    var hill = o.hill || "#8DBF5A";
    ctx.fillStyle = hill;
    ctx.beginPath(); ctx.ellipse(cx - R * 0.35, cy + R * 0.98, R * 1.25, R * 0.55, 0, 0, 7); ctx.fill();
    ctx.fillStyle = K.shade(hill, -0.1);
    ctx.beginPath(); ctx.ellipse(cx + R * 0.7, cy + R * 1.05, R * 1.0, R * 0.5, 0, 0, 7); ctx.fill();
    d.silhouette(ctx, o.figure || "dog", cx - R * 0.08, cy + R * 0.05, R * 1.55, o.figureColor || K.shade(o.colorBottom, -0.04));
    if (o.art === "kibble") d.kibbles(ctx, cx + R * 0.42, cy + R * 0.74, R * 0.95, R * 0.5, o.kibbleColor || "#9A5B2E", r);
    ctx.restore();
    ctx.lineWidth = W * 0.02;
    ctx.strokeStyle = o.accent;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

    ctx.save();
    ctx.translate(W / 2, H * 0.705);
    ctx.rotate(-0.035);
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = W * 0.02; ctx.shadowOffsetY = W * 0.008;
    d.roundRect(ctx, -W * 0.43, -H * 0.052, W * 0.86, H * 0.104, W * 0.03);
    ctx.fillStyle = o.accent;
    ctx.fill();
    ctx.shadowColor = "transparent";
    d.text(ctx, o.title, 0, H * 0.021, "700 " + Math.round(W * 0.095) + "px Fredoka", o.titleInk || "#1D3F29", { maxWidth: W * 0.78 });
    ctx.restore();

    if (o.weight) {
      var bx = W * 0.83, by = H * 0.585, br = W * 0.105;
      ctx.fillStyle = "#FFFCF4";
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      ctx.lineWidth = W * 0.012; ctx.strokeStyle = o.accent; ctx.stroke();
      d.text(ctx, o.weight, bx, by + br * 0.2, "700 " + Math.round(br * 0.6) + "px Fredoka", o.colorBottom, { maxWidth: br * 1.7 });
    }

    d.text(ctx, o.subtitle || "", W / 2, H * 0.815, "800 " + Math.round(W * 0.043) + "px Nunito", ink, { maxWidth: W * 0.86 });
    var feats = (o.features || []).slice(0, 3);
    var pw = W * 0.27, gap = W * 0.025, total = feats.length * pw + (feats.length - 1) * gap, sx = (W - total) / 2;
    feats.forEach(function (f, i) {
      var x = sx + i * (pw + gap), y = H * 0.85;
      d.roundRect(ctx, x, y, pw, H * 0.046, H * 0.023);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fill();
      d.text(ctx, f, x + pw / 2, y + H * 0.032, "800 " + Math.round(W * 0.029) + "px Nunito", ink, { maxWidth: pw * 0.88 });
    });
    d.text(ctx, o.note || "Pet Tem Home · Francisco Morato – SP", W / 2, H * 0.955, "700 " + Math.round(W * 0.025) + "px Nunito", "rgba(255,252,244,0.7)");
    return c;
  }

  function labelBack(o, W, H, r) {
    var c = K.canvas(W, H), ctx = c.getContext("2d"), d = K.draw;
    ctx.fillStyle = o.colorBottom;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 30; i++) d.leaf(ctx, r() * W, r() * H, W * (0.02 + r() * 0.03), r() * 6.28, "rgba(255,255,255,0.05)");
    d.text(ctx, "Pet Tem Home", W / 2, H * 0.09, "600 " + Math.round(W * 0.07) + "px Fredoka", "#FFFCF4");
    d.roundRect(ctx, W * 0.08, H * 0.14, W * 0.84, H * 0.38, W * 0.03);
    ctx.fillStyle = "rgba(255,252,244,0.94)";
    ctx.fill();
    d.text(ctx, "INFORMAÇÕES", W * 0.14, H * 0.19, "800 " + Math.round(W * 0.036) + "px Nunito", o.colorBottom, { align: "left" });
    for (var row = 0; row < 7; row++) {
      var y = H * (0.235 + row * 0.04);
      ctx.fillStyle = "rgba(29,63,41,0.16)";
      ctx.fillRect(W * 0.14, y, W * (0.38 + r() * 0.12), H * 0.012);
      ctx.fillRect(W * 0.72, y, W * 0.12, H * 0.012);
      ctx.fillStyle = "rgba(29,63,41,0.08)";
      ctx.fillRect(W * 0.12, y + H * 0.024, W * 0.76, 2);
    }
    for (var l = 0; l < 6; l++) {
      ctx.fillStyle = "rgba(255,252,244,0.28)";
      ctx.fillRect(W * 0.08, H * (0.57 + l * 0.03), W * (0.84 - (l === 5 ? 0.3 : r() * 0.1)), H * 0.011);
    }
    d.barcode(ctx, W * 0.1, H * 0.8, W * 0.34, H * 0.08, r);
    d.silhouette(ctx, "paw", W * 0.8, H * 0.84, W * 0.14, "rgba(255,252,244,0.35)");
    return c;
  }

  // ---------- saco com volume de "travesseiro" ----------
  function bagGeometry(w, h, d, o) {
    var geo = new THREE.BoxGeometry(w, h, d, 28, 44, 10);
    var pos = geo.attributes.position, v = new THREE.Vector3();
    var topStart = o.topStart || 0.6;
    var wrinkle = o.wrinkle === undefined ? 1 : o.wrinkle;
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var nx = v.x / (w / 2), ny = v.y / (h / 2);
      var ft = K.smoothstep(topStart, 1.0, ny);
      var fb = K.smoothstep(-0.82, -1.0, ny);
      var depth = (1 - ft * 0.93) * (0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - nx * nx * 0.94)));
      depth *= 1 - fb * 0.1;
      var sz = v.z === 0 ? 0 : (v.z > 0 ? 1 : -1);
      var bulge = 0.06 * (1 - nx * nx) * (1 - ny * ny) * (1 - ft);
      var z = v.z * depth + sz * bulge * d;
      z += sz * wrinkle * 0.007 * d * (Math.sin(v.y * 13 + v.x * 4) + 0.5 * Math.sin(v.y * 29 - v.x * 11)) * (1 - ft) * (1 - fb);
      var x = v.x * (1 + ft * 0.05) * (1 - fb * 0.04);
      pos.setXYZ(i, x, v.y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  P.register("bag", function (o) {
    var r = K.rng(o.seed || 3);
    var w = o.w || 1.6, h = o.h || 2.3, d = o.d || 0.62;
    var g = new THREE.Group();
    var W = 1024, H = Math.round(1024 * h / w);
    var finish = o.finish || "gloss";

    function mat(map, color) {
      var col = color || 0xffffff;
      if (finish === "woven") return K.M.matte(col, { map: map, bumpMap: K.T.woven(), bumpScale: 0.012, roughness: 0.92 });
      if (finish === "paper") return K.M.matte(col, { map: map, bumpMap: K.T.noise(4, 2), bumpScale: 0.012, roughness: 0.78 });
      return K.M.plastic(col, { map: map, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.16, bumpMap: K.T.noise(2, 1), bumpScale: 0.004 });
    }
    var side = mat(null, o.colorBottom);
    var body = new THREE.Mesh(bagGeometry(w, h, d, o), [side, side, side, side,
      mat(K.tex(labelFront(o, W, H, r))), mat(K.tex(labelBack(o, W, H, r)))]);
    body.position.y = h / 2;
    g.add(body);

    var sealH = h * 0.052;
    var sealMat = finish === "gloss"
      ? K.M.plastic(K.shade(o.colorTop, -0.06), { bumpMap: K.T.stripes(70, false, 2), bumpScale: 0.035, clearcoat: 0.6 })
      : K.M.matte(K.shade(o.colorTop, -0.06), { bumpMap: K.T.stripes(70, false, 2), bumpScale: 0.04 });
    var seal = new THREE.Mesh(K.G.roundedBox(w * 1.04, sealH, d * 0.085, sealH * 0.25, 3), sealMat);
    seal.position.y = h - sealH * 0.45;
    g.add(seal);

    var hs = o.hs || {};
    var hotspots = [
      K.hot(-w * 0.28, h * 0.5, d * 0.62, (hs.front || [])[0] || "Rótulo completo", (hs.front || [])[1] || "Indicação de uso e informações de cada fase da vida."),
      K.hot(w * 0.3, h - sealH * 0.5, d * 0.05, (hs.seal || [])[0] || "Fechamento reforçado", (hs.seal || [])[1] || "Selagem que preserva aroma e crocância.")
    ];

    var px = w * 0.62, pz = d * 0.55 + 0.38;
    if (o.extras === "kibble") {
      kibblePile(g, o, r, px, pz, 0.42, 90);
      kibblePile(g, o, r, px + 0.5, pz + 0.3, 0.12, 8);
      K.addBounds(g, [-w / 2, 0, -d / 2], [px + 0.66, h, pz + 0.46]);
      hotspots.push(K.hot(px, 0.16, pz, (hs.extra || [])[0] || "Grãos crocantes", (hs.extra || [])[1] || "Tamanho pensado para a mordida do seu pet."));
    } else if (o.extras === "treats") {
      var treatMat = K.M.plastic("#ffffff", { map: K.T.speckle("#8C3B22", ["#5A2414", "#B8653F", "#E0A070"], 1400), roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.5, bumpMap: K.T.noise(8, 2), bumpScale: 0.04 });
      for (var t = 0; t < 6; t++) {
        var stick = new THREE.Mesh(K.G.roundedBox(0.62, 0.075, 0.1, 0.035, 4), treatMat);
        stick.position.set(px - 0.1 + r() * 0.2, 0.04 + (t % 3) * 0.07, pz - 0.15 + t * 0.06);
        stick.rotation.y = -0.5 + t * 0.18 + r() * 0.1;
        stick.rotation.z = (t % 3) * 0.04;
        g.add(stick);
      }
      K.addBounds(g, [-w / 2, 0, -d / 2], [px + 0.45, h, pz + 0.4]);
      hotspots.push(K.hot(px, 0.2, pz + 0.1, "Bifinhos macios", "Fáceis de partir para usar como recompensa."));
    } else if (o.extras === "soil") {
      var mound = new THREE.SphereGeometry(0.55, 72, 40);
      var mp = mound.attributes.position, mv = new THREE.Vector3();
      for (var i = 0; i < mp.count; i++) {
        mv.fromBufferAttribute(mp, i);
        var n = 1 + 0.08 * Math.sin(mv.x * 9 + 1.3) * Math.cos(mv.z * 8) + 0.05 * Math.sin(mv.y * 17 + mv.x * 13);
        mv.multiplyScalar(n);
        mv.y = Math.max(0, mv.y * 0.42);
        mp.setXYZ(i, mv.x, mv.y, mv.z);
      }
      mound.computeVertexNormals();
      var soilMat = K.M.matte("#3E2C20", { bumpMap: K.T.noise(31, 3), bumpScale: 0.12, roughness: 1 });
      var soil = new THREE.Mesh(mound, soilMat);
      soil.position.set(px, 0, pz);
      g.add(soil);
      g.add(scatter(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), 26, r, function () {
        var a = r() * 6.28, rr = 0.45 + r() * 0.35, s = 0.025 + r() * 0.03;
        return { x: px + Math.cos(a) * rr, y: s * 0.5, z: pz + Math.sin(a) * rr, sx: s, sy: s * 0.7, sz: s, color: r() < 0.5 ? "#5B4636" : "#8A7A62" };
      }));
      K.addBounds(g, [-w / 2, 0, -d / 2], [px + 0.85, h, pz + 0.85]);
      hotspots.push(K.hot(px, 0.22, pz, "Terra fofinha", "Rica em matéria orgânica, pronta para plantar."));
    } else if (o.extras === "seeds") {
      g.add(scatter(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), 60, r, function () {
        var a = -0.6 + r() * 1.4, rr = 0.1 + r() * 0.5, s = 0.03 + r() * 0.012;
        return { x: px - 0.2 + Math.cos(a) * rr, y: s * 0.35, z: pz - 0.1 + Math.sin(a) * rr, sx: s, sy: s * 0.5, sz: s * 0.5, rx: 0, rz: 0, color: K.shade("#C9B27A", (r() - 0.5) * 0.2) };
      }));
      K.addBounds(g, [-w / 2, 0, -d / 2], [px + 0.4, h, pz + 0.5]);
      hotspots.push(K.hot(px - 0.1, 0.05, pz, "Sementes selecionadas", "Germinam em poucos dias num vaso ensolarado."));
    }

    g.userData.hotspots = hotspots;
    return g;
  });

  // ---------- comedouro de inox ----------
  P.register("bowl", function (o) {
    var r = K.rng(o.seed || 12);
    var g = new THREE.Group();
    var pts = [
      [0.0, 0.0], [0.6, 0.0], [0.64, 0.015], [0.8, 0.3], [0.88, 0.36], [0.905, 0.38], [0.9, 0.405], [0.87, 0.41],
      [0.84, 0.39], [0.72, 0.12], [0.62, 0.065], [0.0, 0.065]
    ].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var steel = K.M.metal(o.color || "#E4E7EA", o.roughness === undefined ? 0.17 : o.roughness, { bumpMap: K.T.stripes(220, true, 1), bumpScale: 0.002 });
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 128), steel);
    bowl.position.y = 0.035;
    g.add(bowl);
    var base = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.04, 16, 96), K.M.rubber(o.baseColor || "#2B2F2A"));
    base.rotation.x = Math.PI / 2;
    base.position.y = 0.04;
    g.add(base);

    var geo = new THREE.SphereGeometry(1, 14, 10);
    g.add(scatter(geo, kibbleMaterial(), 170, r, function () {
      var a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.66, size = 0.05 + r() * 0.022;
      return {
        x: Math.cos(a) * rr, z: Math.sin(a) * rr,
        y: 0.1 + (0.09 + 0.2 * (rr / 0.66)) * Math.min(1, rr / 0.3) + (1 - Math.pow(rr / 0.66, 2)) * 0.14 + r() * 0.03,
        sx: size, sy: size * 0.62, sz: size * 0.9,
        color: K.shade(o.kibbleColor || "#9A5B2E", (r() - 0.5) * 0.14)
      };
    }));
    g.userData.hotspots = [
      K.hot(0.9, 0.43, 0.1, "Aço inox polido", "Não enferruja, não pega cheiro e vai à lava-louças."),
      K.hot(-0.3, 0.02, 0.62, "Base antiderrapante", "Anel de borracha que evita arrastar e fazer barulho."),
      K.hot(0.1, 0.32, 0.1, "1,5 litro", "Cabe a porção diária de cães médios.")
    ];
    return g;
  });

  // ---------- pote de ração para peixes ----------
  P.register("jar", function (o) {
    var r = K.rng(o.seed || 8);
    var g = new THREE.Group();
    var R = 0.42, H = 1.2;
    // plástico PET transparente (sem "transmission": assim os flocos aparecem com a cor real)
    var bodyMat = new THREE.MeshPhysicalMaterial({ color: "#F4FAF6", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 72, 1, true), bodyMat);
    body.position.y = H / 2;
    g.add(body);
    var bottom = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 0.04, 72), bodyMat);
    bottom.position.y = 0.02;
    g.add(bottom);

    var flakeColors = ["#D8452B", "#E98B2A", "#E9C44A", "#6E9448", "#B8412F"];
    var flakes = scatter(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), 420, r, function () {
      var a = r() * 6.28, rr = Math.sqrt(r()) * (R - 0.05), s = 0.045 + r() * 0.04;
      return { x: Math.cos(a) * rr, y: 0.05 + r() * H * 0.82, z: Math.sin(a) * rr, sx: s, sy: s * 0.7, sz: 0.006, color: flakeColors[Math.floor(r() * flakeColors.length)] };
    });
    flakes.userData.noShadow = true;
    flakes.userData.noReceive = true;
    g.add(flakes);

    var W = 1536, LH = 460, c = K.canvas(W, LH), ctx = c.getContext("2d"), d = K.draw;
    var grad = ctx.createLinearGradient(0, 0, 0, LH);
    grad.addColorStop(0, o.colorTop || "#2F7F8F"); grad.addColorStop(1, o.colorBottom || "#1B4E5B");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, LH);
    for (var b = 0; b < 40; b++) {
      ctx.strokeStyle = "rgba(255,255,255," + (0.12 + r() * 0.2) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r() * W, r() * LH, 4 + r() * 16, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = "rgba(141,191,90,0.9)";
    for (var p = 0; p < 9; p++) d.leaf(ctx, W * 0.3 + p * 16, LH * 0.95, 60 + r() * 50, -0.3 + r() * 0.6, "rgba(141,191,90,0.55)");
    d.silhouette(ctx, "fish", W * 0.37, LH * 0.55, LH * 0.46, "#E98B2A");
    d.silhouette(ctx, "fish", W * 0.34, LH * 0.25, LH * 0.2, "#E9C44A");
    d.text(ctx, "Pet Tem Home", W * 0.56, LH * 0.28, "600 52px Fredoka", "#FFFCF4", { maxWidth: W * 0.28 });
    d.text(ctx, o.title || "RAÇÃO PARA PEIXES", W * 0.56, LH * 0.52, "700 56px Fredoka", "#F3CF6A", { maxWidth: W * 0.3 });
    d.text(ctx, o.subtitle || "Flocos tropicais · 100 g", W * 0.56, LH * 0.7, "800 32px Nunito", "#FFFCF4", { maxWidth: W * 0.3 });
    d.barcode(ctx, W * 0.76, LH * 0.3, W * 0.07, LH * 0.3, r);
    var label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, H * 0.52, 72, 1, true), K.M.plastic("#ffffff", { map: K.tex(c), roughness: 0.4, clearcoat: 0.8 }));
    // centro do rótulo (u = 0,5) virado para a câmera, que fica ~30° à direita
    label.rotation.y = 0.5 - Math.PI;
    label.position.y = H * 0.47;
    g.add(label);

    var capMat = K.M.plastic(o.capColor || "#E9B949", { bumpMap: K.T.stripes(90, false, 1), bumpScale: 0.03, roughness: 0.35 });
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.2, 72), capMat);
    cap.position.y = H + 0.1;
    g.add(cap);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.03, 0.02, 72), K.M.plastic(o.capColor || "#E9B949", { roughness: 0.3 }));
    top.position.y = H + 0.21;
    g.add(top);

    g.userData.hotspots = [
      K.hot(0, H * 0.9, R + 0.02, "Flocos coloridos", "Mix de ingredientes que realça as cores dos peixes."),
      K.hot(R * 0.7, H + 0.2, R * 0.7, "Tampa dosadora", "Rosqueável, mantém os flocos secos.")
    ];
    return g;
  });

  // ---------- bolinha de tênis ----------
  function tennisBall(o, r) {
    var R = 0.34;
    var W = 1024, H = 512, c = K.canvas(W, H), ctx = c.getContext("2d");
    ctx.fillStyle = o.color || "#CFE042";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.18;
    ctx.globalCompositeOperation = "multiply";
    var noise = K.T.noise(17, 1).image;
    ctx.drawImage(noise, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    K.draw.silhouette(ctx, "paw", W * 0.25, H * 0.42, 60, "rgba(29,63,41,0.85)");
    K.draw.text(ctx, "PET TEM HOME", W * 0.25, H * 0.56, "700 34px Fredoka", "rgba(29,63,41,0.85)");
    var felt = K.M.fabric("#ffffff", { map: K.tex(c), sheenColor: K.shade(o.color || "#CFE042", 0.04), sheenRoughness: 0.6, bumpMap: K.T.fuzz(), bumpScale: 0.025 });
    var ball = new THREE.Group();
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), felt));

    var a = 0.72, b = 0.28, pts = [];
    for (var i = 0; i < 240; i++) {
      var t = i / 240 * Math.PI * 2;
      pts.push(new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), 2 * Math.sqrt(a * b) * Math.sin(2 * t)).multiplyScalar(R * 1.001));
    }
    var seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 480, R * 0.03, 10, true), K.M.rubber("#F3F0E6", { roughness: 0.55, bumpScale: 0.002 }));
    ball.add(seam);
    return ball;
  }

  P.register("ball", function (o) {
    var r = K.rng(o.seed || 4);
    var g = new THREE.Group();
    var R = 0.34;
    var spots = (o.count || 3) === 1 ? [[0, 0]] : [[0.05, 0.3], [-0.62, -0.3], [0.62, -0.38]];
    spots.forEach(function (s, i) {
      var ball = tennisBall(o, r);
      ball.position.set(s[0], R, s[1]);
      ball.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28);
      if (i === 0) ball.rotation.set(0.4, 0.2, 0.1);
      g.add(ball);
    });
    g.userData.hotspots = [
      K.hot(0.05, R * 1.9, 0.3, "Feltro macio", "Não machuca a boca e é fácil de pegar."),
      K.hot(0.05 + R * 0.7, R * 1.2, 0.3 + R * 0.6, "Costura resistente", "Aguenta muitas buscas e mordidas."),
      K.hot(-0.62, R * 1.3, -0.3 + R * 0.8, "Kit com 3", "Para ter sempre uma reserva no quintal.")
    ];
    return g;
  });

  // ---------- osso de nylon ----------
  P.register("bone", function (o) {
    var g = new THREE.Group();
    var color = o.color || "#EDE3CF";
    var nylon = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: K.T.speckle(color, [K.shade(color, -0.25), K.shade(color, -0.12), "#B86F3E"], 700),
      roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.3, sheenRoughness: 0.6,
      sheenColor: new THREE.Color("#ffffff")
    });
    var ribbed = nylon.clone();
    ribbed.bumpMap = K.T.stripes(26, true, 3);
    ribbed.bumpScale = 0.05;

    var profile = [];
    for (var i = 0; i <= 40; i++) {
      var y = -1.05 + (i / 40) * 2.1, ny = y / 1.05;
      profile.push(new THREE.Vector2(0.23 + 0.06 * ny * ny, y));
    }
    var shaft = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), ribbed);
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);
    [-1, 1].forEach(function (side) {
      [-1, 1].forEach(function (z) {
        var knob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), nylon);
        knob.position.set(side * 1.13, 0, z * 0.25);
        knob.scale.set(1, 0.92, 1);
        g.add(knob);
      });
      var join = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 28), nylon);
      join.position.set(side * 0.98, 0, 0);
      g.add(join);
    });
    g.position.y = 0.34 * 0.92;
    g.rotation.y = -0.35;
    var outer = new THREE.Group();
    outer.add(g);
    outer.userData.hotspots = [
      K.hot(0.2, 0.62, 0.1, "Relevos na haste", "Ajudam a remover a placa enquanto o cão rói."),
      K.hot(-1.25, 0.6, 0.55, "Pontas firmes", "Formato fácil de segurar com as patas."),
      K.hot(0.95, 0.3, -0.6, "Nylon atóxico", "Durável, para mastigadores intensos.")
    ];
    return outer;
  });
})();
