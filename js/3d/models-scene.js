// Bosque Pet — modelos 3D: aquário, plantas, arranhador e roupinhas

(function () {
  "use strict";

  var P = window.Pet3D;
  if (!P) return;
  var K = P.K, THREE = K.THREE;

  function scatter(geo, material, count, place) {
    var mesh = new THREE.InstancedMesh(geo, material, count);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    for (var i = 0; i < count; i++) {
      var info = place(i);
      p.set(info.x, info.y, info.z);
      e.set(info.rx || 0, info.ry || 0, info.rz || 0);
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

  // ---------- folhas e plantas ----------
  var leafMats = {};
  function leafMat(color, glossy) {
    var key = color + glossy;
    if (!leafMats[key]) {
      leafMats[key] = new THREE.MeshPhysicalMaterial({
        color: color, roughness: glossy ? 0.32 : 0.55, side: THREE.DoubleSide,
        sheen: 0.4, sheenColor: new THREE.Color(K.shade(color, 0.3)), sheenRoughness: 0.5,
        clearcoat: glossy ? 0.5 : 0
      });
    }
    return leafMats[key];
  }

  function blade(height, width, bend, color) {
    var geo = new THREE.PlaneGeometry(width, height, 1, 10);
    geo.translate(0, height / 2, 0);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var ty = pos.getY(i) / height;
      pos.setX(i, pos.getX(i) * (1 - ty * 0.75) + bend * ty * ty);
      pos.setZ(i, Math.sin(ty * 3) * 0.01);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, leafMat(color));
  }

  function broadLeaf(len, wid, color) {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(wid, len * 0.35, 0, len);
    s.quadraticCurveTo(-wid, len * 0.35, 0, 0);
    var geo = new THREE.ShapeGeometry(s, 12);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      pos.setZ(i, -Math.abs(x) * 0.6 + pos.getY(i) * pos.getY(i) * 0.25);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, leafMat(color, true));
  }

  function grassClump(r, count, maxH, colors, spread) {
    var g = new THREE.Group();
    for (var i = 0; i < count; i++) {
      var b = blade(maxH * (0.55 + r() * 0.45), 0.035 + r() * 0.02, (r() - 0.5) * 0.25, colors[Math.floor(r() * colors.length)]);
      b.position.set((r() - 0.5) * spread, 0, (r() - 0.5) * spread);
      b.rotation.y = r() * Math.PI;
      b.userData.sway = { phase: r() * 6, amp: 0.04 + r() * 0.05 };
      g.add(b);
    }
    return g;
  }

  function leafyPlant(r, count, size, color) {
    var g = new THREE.Group();
    for (var i = 0; i < count; i++) {
      var stem = new THREE.Group();
      var leaf = broadLeaf(size * (0.7 + r() * 0.4), size * 0.38, K.shade(color, (r() - 0.5) * 0.1));
      leaf.rotation.x = -0.5 - r() * 0.5;
      stem.add(leaf);
      stem.rotation.y = (i / count) * Math.PI * 2 + r() * 0.4;
      stem.userData.sway = { phase: r() * 6, amp: 0.03 };
      g.add(stem);
    }
    return g;
  }

  function swayAll(group, t) {
    group.traverse(function (o) {
      if (o.userData.sway) o.rotation.z = Math.sin(t * 1.3 + o.userData.sway.phase) * o.userData.sway.amp;
    });
  }

  // ---------- peixes ----------
  function fishTexture(style) {
    var W = 256, H = 512, c = K.canvas(W, H), ctx = c.getContext("2d");
    if (style === "clown") {
      ctx.fillStyle = "#F07A1E"; ctx.fillRect(0, 0, W, H);
      [0.3, 0.56, 0.82].forEach(function (s, i) {
        var y = H * (1 - s), bh = H * (i === 1 ? 0.07 : 0.055);
        ctx.fillStyle = "#1A1410"; ctx.fillRect(0, y - bh / 2 - 7, W, bh + 14);
        ctx.fillStyle = "#FFFDF6"; ctx.fillRect(0, y - bh / 2, W, bh);
      });
      ctx.fillStyle = "#1A1410"; ctx.fillRect(0, 0, W, H * 0.05);
    } else {
      var g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "#C9D4DA"); g.addColorStop(0.08, "#2CB5E8"); g.addColorStop(0.14, "#C9D4DA");
      g.addColorStop(0.25, "#7A8C96"); g.addColorStop(0.36, "#C9D4DA"); g.addColorStop(0.42, "#2CB5E8");
      g.addColorStop(0.5, "#C9D4DA"); g.addColorStop(0.58, "#E0402E"); g.addColorStop(0.75, "#F3EDE6");
      g.addColorStop(0.92, "#E0402E"); g.addColorStop(1, "#C9D4DA");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(201,212,218,0.9)"; ctx.fillRect(0, 0, W, H * 0.45);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = g; ctx.globalAlpha = 0.9; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      var g2 = ctx.createLinearGradient(0, 0, W, 0);
      g2.addColorStop(0, "rgba(44,181,232,0)"); g2.addColorStop(0.08, "#2CB5E8"); g2.addColorStop(0.16, "rgba(44,181,232,0)");
      g2.addColorStop(0.34, "rgba(44,181,232,0)"); g2.addColorStop(0.42, "#2CB5E8"); g2.addColorStop(0.5, "rgba(44,181,232,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H * 0.45);
    }
    return K.tex(c, {});
  }

  function fish(style, scale) {
    var L = 0.34, pts = [];
    for (var i = 0; i <= 24; i++) {
      var s = i / 24;
      var rad = Math.pow(Math.sin(Math.PI * Math.min(0.97, s)), 0.7) * 0.072 * (1 - 0.45 * s);
      pts.push(new THREE.Vector2(Math.max(0.001, rad), s * L - L / 2));
    }
    var geo = new THREE.LatheGeometry(pts, 32);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, style === "clown" ? 1.25 : 0.9, 0.5);
    var color = style === "clown" ? "#F07A1E" : "#C9D4DA";
    var bodyMat = new THREE.MeshPhysicalMaterial({
      map: fishTexture(style), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
      iridescence: style === "clown" ? 0 : 0.8, iridescenceIOR: 1.6
    });
    var finMat = new THREE.MeshPhysicalMaterial({ color: color, roughness: 0.4, transparent: true, opacity: style === "clown" ? 0.95 : 0.55, side: THREE.DoubleSide });
    var g = new THREE.Group();
    g.add(new THREE.Mesh(geo, bodyMat));

    var tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(-0.07, 0.07, -0.12, 0.08);
    tailShape.lineTo(-0.085, 0);
    tailShape.lineTo(-0.12, -0.08);
    tailShape.quadraticCurveTo(-0.07, -0.07, 0, 0);
    var tail = new THREE.Group();
    tail.position.x = -L / 2 + 0.02;
    tail.add(new THREE.Mesh(new THREE.ShapeGeometry(tailShape, 8), finMat));
    g.add(tail);

    var dorsal = new THREE.Shape();
    dorsal.moveTo(-0.09, 0);
    dorsal.quadraticCurveTo(-0.02, 0.075, 0.06, 0);
    var dm = new THREE.Mesh(new THREE.ShapeGeometry(dorsal, 8), finMat);
    dm.position.y = style === "clown" ? 0.075 : 0.055;
    g.add(dm);

    var eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.1, clearcoat: 1 });
    [-1, 1].forEach(function (side) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), eyeMat);
      eye.position.set(L / 2 - 0.06, 0.018, side * 0.03);
      g.add(eye);
    });
    g.scale.setScalar(scale || 1);
    g.userData.tail = tail;
    return g;
  }

  // ---------- aquário ----------
  P.register("aquarium", function (o) {
    var r = K.rng(o.seed || 42);
    var g = new THREE.Group();
    var w = o.w || 2.6, h = o.h || 1.5, d = o.d || 1.05;

    var stand = new THREE.Mesh(K.G.roundedBox(w + 0.3, 0.12, d + 0.3, 0.03, 3), K.M.matte("#ffffff", { map: K.T.wood("#8A5A34"), roughness: 0.55 }));
    stand.position.y = 0.06;
    g.add(stand);
    var y0 = 0.12;
    var waterTop = y0 + h * 0.86;

    var trim = new THREE.Mesh(K.G.roundedBox(w + 0.02, 0.05, d + 0.02, 0.01, 2), K.M.matte("#1B1E1B", { roughness: 0.5 }));
    trim.position.y = y0 + 0.025;
    g.add(trim);

    var water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, waterTop - y0 - 0.05, d - 0.05), K.M.glass({
      color: "#D8F0EC", roughness: 0.05, thickness: 1.2, ior: 1.33, attenuationColor: "#5FB3AC", attenuationDistance: 3.2
    }));
    water.position.y = (waterTop + y0 + 0.05) / 2;
    g.add(water);

    var glassMat = new THREE.MeshPhysicalMaterial({ color: "#EAF7F2", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false, clearcoat: 1, side: THREE.DoubleSide });
    var edgeMat = new THREE.MeshPhysicalMaterial({ color: "#9CCFBF", roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
    var panes = [[w, h, 0.012, 0, 0, d / 2], [w, h, 0.012, 0, 0, -d / 2], [0.012, h, d, w / 2, 0, 0], [0.012, h, d, -w / 2, 0, 0]];
    panes.forEach(function (p) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), glassMat);
      m.position.set(p[3], y0 + h / 2, p[5]);
      m.userData.noShadow = true;
      m.renderOrder = 2;
      g.add(m);
    });
    var e = 0.02;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var v = new THREE.Mesh(new THREE.BoxGeometry(e, h, e), edgeMat);
      v.position.set(c[0] * w / 2, y0 + h / 2, c[1] * d / 2);
      v.userData.noShadow = true;
      g.add(v);
    });
    [[w, e, e, 0, d / 2], [w, e, e, 0, -d / 2], [e, e, d, w / 2, 0], [e, e, d, -w / 2, 0]].forEach(function (b) {
      var top = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), edgeMat);
      top.position.set(b[3], y0 + h, b[4]);
      top.userData.noShadow = true;
      g.add(top);
    });

    var fill = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.1, d - 0.06), K.M.matte("#5E4E3B"));
    fill.position.y = y0 + 0.05;
    g.add(fill);
    var gravelColors = ["#C8B48A", "#8C7A5B", "#5E5446", "#D9CDB0", "#6F6A60", "#A89272"];
    g.add(scatter(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, bumpMap: K.T.noise(3, 2), bumpScale: 0.3 }), 1400, function () {
      var x = (r() - 0.5) * (w - 0.1), z = (r() - 0.5) * (d - 0.1), s = 0.018 + r() * 0.022;
      var slope = 0.02 + 0.13 * (0.5 - z / d);
      return { x: x, y: y0 + 0.08 + slope * r(), z: z, rx: r() * 6, ry: r() * 6, rz: r() * 6, sx: s, sy: s * 0.7, sz: s * 0.9, color: gravelColors[Math.floor(r() * gravelColors.length)] };
    }));
    var ground = function (z) { return y0 + 0.1 + 0.13 * (0.5 - z / d) * 0.6; };

    var stoneMat = K.M.matte("#7C8782", { bumpMap: K.T.noise(19, 2), bumpScale: 0.15, roughness: 0.92 });
    [[-0.55, -0.15, 0.3, 0.22, 0.24], [0.75, 0.05, 0.22, 0.16, 0.2], [-0.2, 0.18, 0.14, 0.1, 0.12]].forEach(function (s, i) {
      var geo = new THREE.IcosahedronGeometry(1, 3);
      var pos = geo.attributes.position, v = new THREE.Vector3();
      for (var k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k);
        v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 4 + i) * Math.cos(v.z * 3 + i) + 0.05 * Math.sin(v.y * 9));
        pos.setXYZ(k, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      var rock = new THREE.Mesh(geo, stoneMat);
      rock.scale.set(s[2], s[3], s[4]);
      rock.position.set(s[0], ground(s[1]) + s[3] * 0.45, s[1]);
      rock.rotation.set(r(), r() * 6, r() * 0.3);
      g.add(rock);
    });

    var woodMat = K.M.matte("#ffffff", { map: K.T.wood("#5C3E26"), bumpMap: K.T.noise(23, 2), bumpScale: 0.1, roughness: 0.85 });
    [[[-0.95, 0.12, 0.05], [-0.6, 0.35, -0.1], [-0.3, 0.6, -0.22], [-0.05, 0.85, -0.3]],
     [[-0.6, 0.35, -0.1], [-0.75, 0.62, -0.28], [-0.7, 0.9, -0.38]]].forEach(function (pts, i) {
      var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], y0 + p[1], p[2]); }));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, i === 0 ? 0.045 : 0.03, 10, false), woodMat));
    });

    var plants = new THREE.Group();
    var greens = ["#4F8A3C", "#6FA84A", "#3E7040", "#8BBF5A"];
    var maxH = waterTop - y0 - 0.25;
    for (var c = 0; c < 7; c++) {
      var x = -w / 2 + 0.25 + c * (w - 0.5) / 6 + (r() - 0.5) * 0.12;
      var clump = grassClump(r, 12, maxH * (0.6 + r() * 0.4), c === 5 ? ["#A6453A", "#C0643F", "#8C3A30"] : greens, 0.22);
      clump.position.set(x, ground(-d / 2 + 0.2), -d / 2 + 0.18 + r() * 0.1);
      plants.add(clump);
    }
    for (var f = 0; f < 6; f++) {
      var carpet = grassClump(r, 14, 0.12, ["#7DBA4E", "#9BCB5E"], 0.3);
      carpet.position.set(-w / 2 + 0.3 + f * 0.42, ground(d / 2 - 0.2), d / 2 - 0.2 - r() * 0.12);
      plants.add(carpet);
    }
    var anubias = leafyPlant(r, 7, 0.2, "#2F5A2E");
    anubias.position.set(0.72, ground(0.05) + 0.18, 0.05);
    plants.add(anubias);
    g.add(plants);

    var school = [];
    [["clown", 1.1, 0.1, 0.55, 0.35, 0.28, 0.5], ["clown", 1.0, -0.25, 0.75, 0.55, 0.22, 0.38],
     ["neon", 0.7, 0.15, 0.95, 0.7, 0.3, 0.7], ["neon", 0.7, 0.1, 1.0, 0.6, 0.25, 0.8], ["neon", 0.7, 0.2, 0.9, 0.8, 0.28, 0.75]]
      .forEach(function (fd, i) {
        var fishy = fish(fd[0], fd[1]);
        fishy.userData.path = { cx: fd[2], cy: y0 + fd[3] * (waterTop - y0) * 0.85, rx: fd[4], rz: fd[5], speed: fd[6] * (i % 2 ? -1 : 1), phase: i * 1.7 };
        g.add(fishy);
        school.push(fishy);
      });

    var bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.4, clearcoat: 1, depthWrite: false });
    var bubbles = [];
    var stoneX = w / 2 - 0.3, stoneZ = -d / 2 + 0.2;
    var airstone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 20), K.M.matte("#3A3D3A"));
    airstone.position.set(stoneX, ground(stoneZ) + 0.02, stoneZ);
    g.add(airstone);
    for (var b = 0; b < 30; b++) {
      var bub = new THREE.Mesh(new THREE.SphereGeometry(0.012 + r() * 0.014, 12, 10), bubbleMat);
      bub.userData = { noShadow: true, speed: 0.25 + r() * 0.2, phase: r() * 6, y: r() };
      bub.renderOrder = 3;
      g.add(bub);
      bubbles.push(bub);
    }

    var lamp = new THREE.Mesh(K.G.roundedBox(w * 0.92, 0.045, 0.16, 0.02, 3), K.M.matte("#1C1F1C", { roughness: 0.4 }));
    lamp.position.y = y0 + h + 0.09;
    g.add(lamp);
    var led = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.006, 0.08), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xEAF6FF, emissiveIntensity: 2.5 }));
    led.position.y = y0 + h + 0.065;
    led.userData.noShadow = true;
    g.add(led);
    [-1, 1].forEach(function (sd) {
      var leg = new THREE.Mesh(K.G.roundedBox(0.03, 0.08, 0.05, 0.01, 2), K.M.matte("#1C1F1C"));
      leg.position.set(sd * w * 0.43, y0 + h + 0.04, 0);
      g.add(leg);
    });
    var filter = new THREE.Mesh(K.G.roundedBox(0.36, 0.46, 0.15, 0.04, 3), K.M.plastic("#232623", { roughness: 0.5, clearcoat: 0.3 }));
    filter.position.set(w * 0.28, y0 + h - 0.13, -d / 2 - 0.08);
    g.add(filter);
    var intake = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, h * 0.7, 16), K.M.plastic("#2A3A36", { roughness: 0.3 }));
    intake.position.set(w * 0.28, y0 + h * 0.55, -d / 2 + 0.06);
    g.add(intake);

    g.userData.update = function (t) {
      school.forEach(function (fishy) {
        var p = fishy.userData.path, a = p.phase + t * p.speed;
        fishy.position.set(p.cx + Math.cos(a) * p.rx, p.cy + Math.sin(a * 2.3) * 0.04, Math.sin(a) * p.rz);
        var dx = -Math.sin(a) * p.rx * p.speed, dz = Math.cos(a) * p.rz * p.speed;
        fishy.rotation.y = Math.atan2(-dz, dx);
        fishy.userData.tail.rotation.y = Math.sin(t * 11 + p.phase) * 0.4;
      });
      bubbles.forEach(function (bub) {
        var u = bub.userData, k = (u.y + t * u.speed * 0.5) % 1;
        var base = ground(stoneZ) + 0.05;
        bub.position.set(stoneX + Math.sin(t * 3 + u.phase) * 0.02 * k, base + k * (waterTop - base - 0.02), stoneZ + Math.cos(t * 2.4 + u.phase) * 0.02 * k);
      });
      swayAll(plants, t);
    };

    g.userData.hotspots = [
      K.hot(-w * 0.3, y0 + h * 0.3, d / 2, "Vidro extra claro", "Visão nítida de todos os ângulos, 40 litros."),
      K.hot(0, y0 + h + 0.1, 0.08, "Luminária LED", "Luz econômica que valoriza as cores e ajuda as plantas."),
      K.hot(w * 0.28, y0 + h - 0.05, -d / 2 - 0.15, "Filtro incluso", "Mantém a água limpa e oxigenada, com baixo ruído."),
      K.hot(w * 0.2, y0 + 0.25, d / 2, "Decoração ilustrativa", "Peixes, plantas e pedras são vendidos separadamente.")
    ];
    return g;
  });

  // ---------- kit de plantas ----------
  P.register("plantkit", function (o) {
    var r = K.rng(o.seed || 51);
    var g = new THREE.Group();
    var potMat = K.M.plastic("#2A2D2A", { roughness: 0.6, clearcoat: 0.2, bumpMap: K.T.stripes(40, true, 2), bumpScale: 0.02 });
    var woolMat = K.M.fabric("#D9CBA8", { bumpScale: 0.1, sheenRoughness: 0.8 });
    var spots = [[-0.46, 0.26], [0, 0.34], [0.46, 0.26], [-0.23, -0.2], [0.24, -0.2]];
    var plants = new THREE.Group();
    spots.forEach(function (s, i) {
      var pot = new THREE.Group();
      var profile = [[0.001, 0], [0.12, 0], [0.155, 0.25], [0.175, 0.26], [0.175, 0.285], [0.16, 0.285]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
      pot.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), potMat));
      var wool = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.04, 40), woolMat);
      wool.position.y = 0.27;
      pot.add(wool);
      var plant;
      if (i === 1 || i === 3) {
        plant = leafyPlant(r, 8, 0.28, i === 1 ? "#3F7A36" : "#2F5A2E");
        plant.position.y = 0.3;
      } else {
        plant = grassClump(r, 16, 0.55 + r() * 0.35, i === 4 ? ["#A6453A", "#C0643F", "#7A8C3A"] : ["#4F8A3C", "#6FA84A", "#8BBF5A"], 0.16);
        plant.position.y = 0.29;
      }
      pot.add(plant);
      pot.position.set(s[0], 0, s[1]);
      pot.rotation.y = r() * 6;
      plants.add(pot);
    });
    g.add(plants);
    g.userData.update = function (t) { swayAll(plants, t); };
    g.userData.hotspots = [
      K.hot(0, 0.75, 0.34, "Plantas naturais", "Espécies fáceis, que crescem bem com pouca luz."),
      K.hot(0.46, 0.2, 0.42, "Copinho com lã de rocha", "É só retirar do vaso e plantar no substrato."),
      K.hot(0.24, 0.7, -0.2, "5 mudas diferentes", "Monte fundo, meio e frente do aquário.")
    ];
    return g;
  });

  // ---------- arranhador ----------
  P.register("scratcher", function (o) {
    var g = new THREE.Group();
    var plush = K.M.fabric(o.color || "#CDBBA0", { bumpScale: 0.12, sheenRoughness: 0.7 });
    var base = new THREE.Mesh(K.G.roundedBox(1.3, 0.16, 1.3, 0.07, 5), plush);
    base.position.y = 0.08;
    g.add(base);

    var W = 512, H = 1024, c = K.canvas(W, H), ctx = c.getContext("2d"), r = K.rng(9);
    ctx.fillStyle = "#C7A36D"; ctx.fillRect(0, 0, W, H);
    for (var row = 0; row < 64; row++) {
      var y = row * H / 64;
      var grad = ctx.createLinearGradient(0, y, 0, y + H / 64);
      grad.addColorStop(0, "rgba(90,60,25,0.28)"); grad.addColorStop(0.5, "rgba(240,210,150,0.18)"); grad.addColorStop(1, "rgba(90,60,25,0.28)");
      ctx.fillStyle = grad; ctx.fillRect(0, y, W, H / 64);
    }
    for (var f = 0; f < 2600; f++) {
      ctx.strokeStyle = r() < 0.5 ? "rgba(255,235,190,0.35)" : "rgba(80,55,25,0.35)";
      ctx.lineWidth = 1;
      var fx = r() * W, fy = r() * H;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 6 + r() * 14, fy + (r() - 0.5) * 3); ctx.stroke();
    }
    var sisal = K.M.matte("#ffffff", { map: K.tex(c, { repeat: [3, 1] }), bumpMap: K.T.stripes(64, true, 1.5), bumpScale: 0.12, roughness: 0.95 });
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.55, 48, 1, true), sisal);
    post.position.set(-0.18, 0.16 + 1.55 / 2, -0.12);
    g.add(post);

    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 64), plush);
    top.position.set(-0.18, 1.76, -0.12);
    g.add(top);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 20, 96), plush);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(-0.18, 1.76, -0.12);
    g.add(rim);

    var swing = new THREE.Group();
    swing.position.set(0.22, 1.72, 0.2);
    var string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 8), K.M.matte("#EDE6D6"));
    string.position.y = -0.275;
    swing.add(string);
    var pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 4), K.M.fabric(o.pomColor || "#E88AA2", { bumpScale: 0.3, sheenRoughness: 0.9 }));
    pom.position.y = -0.6;
    swing.add(pom);
    g.add(swing);

    g.userData.update = function (t) {
      swing.rotation.z = Math.sin(t * 1.6) * 0.18;
      swing.rotation.x = Math.cos(t * 1.1) * 0.08;
    };
    g.userData.hotspots = [
      K.hot(-0.18, 0.9, 0.04, "Sisal natural", "Fibra resistente que salva o sofá das unhas."),
      K.hot(-0.5, 1.82, 0.15, "Plataforma acolchoada", "Lugar alto para observar e cochilar."),
      K.hot(0.22, 1.1, 0.3, "Pompom interativo", "Estimula o instinto de caça."),
      K.hot(0.45, 0.17, 0.5, "Base pesada", "Não tomba quando o gato se pendura.")
    ];
    return g;
  });

  // ---------- roupinhas dobradas ----------
  function topUV(geo, w, d) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, 0.5 - pos.getZ(i) / d);
    return geo;
  }

  // caixa "de tecido": cantos totalmente arredondados e topo estufado
  function softBox(w, h, d, r) {
    var geo = new THREE.BoxGeometry(w, h, d, 40, 8, 32);
    var pos = geo.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3();
    var hw = w / 2 - r, hh = Math.max(0, h / 2 - r), hd = d / 2 - r;
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      inner.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
      v.sub(inner);
      if (v.lengthSq() > 0) v.normalize().multiplyScalar(r);
      v.add(inner);
      var nx = v.x / (w / 2), nz = v.z / (d / 2);
      if (v.y > 0) v.y += 0.035 * (1 - nx * nx) * (1 - nz * nz) + 0.006 * Math.sin(v.x * 9 + v.z * 3);
      else v.y *= 0.85;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function garmentTop(o, W, H, style) {
    var c = K.canvas(W, H), ctx = c.getContext("2d"), d = K.draw, r = K.rng(77);
    var base = o.color;
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = style === "hoodie" ? 0.22 : 0.08;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(K.T.noise(13, 1).image, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (style === "hoodie") {
      for (var x = 0; x < W; x += 6) {
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(x, H * 0.84, 3, H * 0.16);
      }
      ctx.strokeStyle = K.shade(base, -0.15); ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
      d.roundRect(ctx, W * 0.24, H * 0.46, W * 0.52, H * 0.3, 30); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, H * 0.835, W, 6);
      d.silhouette(ctx, "paw", W * 0.5, H * 0.28, W * 0.2, K.shade(base, 0.22));
      d.text(ctx, "BOSQUE PET", W * 0.5, H * 0.42, "700 " + Math.round(W * 0.05) + "px Fredoka", K.shade(base, 0.22));
    } else {
      ctx.fillStyle = "#DADFE3"; ctx.fillRect(0, H * 0.58, W, H * 0.07);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(0, H * 0.595, W, H * 0.012);
      ctx.fillStyle = K.shade(base, -0.12);
      for (var s = 0; s < 4; s++) { ctx.beginPath(); ctx.arc(W * 0.5, H * (0.2 + s * 0.1), W * 0.018, 0, 7); ctx.fill(); }
      ctx.strokeStyle = K.shade(base, -0.1); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.1); ctx.lineTo(W * 0.5, H * 0.56); ctx.stroke();
    }
    return K.tex(c, {});
  }

  P.register("folded", function (o) {
    var style = o.style || "hoodie";
    var g = new THREE.Group();
    var w = 1.3, h = 0.2, d = 1.0;

    function piece(color, scale) {
      var opts = Object.assign({}, o, { color: color });
      var mat = style === "hoodie"
        ? K.M.fabric("#ffffff", { map: garmentTop(opts, 1024, 800, style), bumpMap: K.T.noise(29, 6), bumpScale: 0.02, sheen: 0.6, sheenRoughness: 0.7, sheenColor: color })
        : K.M.plastic("#ffffff", { map: garmentTop(opts, 1024, 800, style), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, bumpMap: K.T.noise(27, 1), bumpScale: 0.006 });
      return new THREE.Mesh(topUV(softBox(w * scale, h, d * scale, h / 2), w * scale, d * scale), mat);
    }

    var bottom = piece(o.color2 || K.shade(o.color, -0.08), 1.04);
    bottom.position.y = h / 2;
    bottom.rotation.y = 0.12;
    g.add(bottom);
    var top = piece(o.color, 1);
    top.position.set(0.04, h * 1.5 - 0.01, 0.03);
    top.rotation.y = -0.05;
    g.add(top);

    var hoodGeo = new THREE.CapsuleGeometry(0.07, 0.46, 8, 24);
    hoodGeo.rotateZ(Math.PI / 2);
    hoodGeo.scale(1, 0.6, 1);
    var hoodMat = style === "hoodie"
      ? K.M.fabric(o.color, { bumpScale: 0.012, sheenRoughness: 0.6 })
      : K.M.plastic(o.color, { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
    var hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0.02, h * 2 + 0.035, -0.3);
    hood.rotation.y = -0.05;
    g.add(hood);

    var tc = K.canvas(256, 380), tctx = tc.getContext("2d");
    tctx.fillStyle = "#FFFCF4"; tctx.fillRect(0, 0, 256, 380);
    tctx.fillStyle = "#2E5E3E"; tctx.fillRect(0, 0, 256, 120);
    K.draw.silhouette(tctx, "paw", 128, 62, 80, "#F7F3E8");
    K.draw.text(tctx, "Bosque Pet", 128, 175, "600 34px Fredoka", "#2E5E3E");
    K.draw.text(tctx, o.size || "P · M · G · GG", 128, 230, "800 26px Nunito", "#4B5944");
    tctx.strokeStyle = "#ddd"; tctx.lineWidth = 6;
    tctx.beginPath(); tctx.arc(128, 330, 16, 0, 7); tctx.stroke();
    var tag = new THREE.Mesh(K.G.roundedBox(0.2, 0.3, 0.008, 0.02, 2), K.M.matte("#ffffff", { map: K.tex(tc), roughness: 0.7 }));
    tag.rotation.x = -Math.PI / 2 + 0.08;
    tag.rotation.z = 0.5;
    tag.position.set(0.52, h * 2 + 0.02, 0.36);
    g.add(tag);
    var cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.44, h * 2 + 0.03, 0.26), new THREE.Vector3(0.36, h * 2 + 0.06, 0.12), new THREE.Vector3(0.3, h * 2 + 0.02, 0.0)
    ]), 20, 0.005, 6, false), K.M.matte("#8C5A30"));
    g.add(cord);

    g.userData.hotspots = style === "hoodie" ? [
      K.hot(0.04, h * 2 + 0.02, 0.2, "Moletom forrado", "Por dentro é felpudo, quentinho para o inverno."),
      K.hot(0.6, h * 1.5, 0.5, "Punhos com ribana", "Não aperta e não sai do lugar."),
      K.hot(0.52, h * 2 + 0.04, 0.36, "Do P ao GG", "Confira a medida do seu pet com a loja.")
    ] : [
      K.hot(0.04, h * 2 + 0.02, 0.1, "Impermeável", "Tecido emborrachado que não deixa a água passar."),
      K.hot(0.7, h * 1.5, -0.05, "Faixa refletiva", "Mais segurança nos passeios à noite."),
      K.hot(0.52, h * 2 + 0.04, 0.36, "Com capuz", "Protege a cabeça e as orelhas da chuva.")
    ];
    return g;
  });
})();
