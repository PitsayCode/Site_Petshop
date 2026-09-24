// Bosque Pet — modelos 3D: vara com molinete, iscas e ferramentas de jardim

(function () {
  "use strict";

  var P = window.Pet3D;
  if (!P) return;
  var K = P.K, THREE = K.THREE;

  // perfil de revolução ao longo de X (de x0 a x1), raio em função de t (0..1)
  function latheX(x0, x1, radius, steps, seg) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      pts.push(new THREE.Vector2(Math.max(0.0008, radius(t)), x0 + (x1 - x0) * t));
    }
    var geo = new THREE.LatheGeometry(pts, seg || 40);
    geo.rotateZ(-Math.PI / 2);
    return geo;
  }

  // ---------- vara + molinete ----------
  P.register("rod", function (o) {
    var g = new THREE.Group();
    var rod = new THREE.Group();
    var L = 2.3;
    var carbon = K.M.plastic(o.color || "#1B1F22", { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, bumpMap: K.T.woven(), bumpScale: 0.004 });
    rod.add(new THREE.Mesh(latheX(0, L, function (t) { return 0.028 - 0.022 * t; }, 20, 24), carbon));

    var cork = K.M.matte("#ffffff", { map: K.T.speckle("#C49A6C", ["#8A6440", "#E3C49C", "#6B4A2E"], 5000), bumpMap: K.T.noise(35, 3), bumpScale: 0.08, roughness: 0.9 });
    rod.add(new THREE.Mesh(latheX(-0.55, 0.02, function (t) { return 0.045 + 0.012 * Math.sin(t * Math.PI); }, 24, 32), cork));
    var butt = new THREE.Mesh(latheX(-0.6, -0.54, function (t) { return 0.05 - 0.015 * (1 - t) * (1 - t); }, 8, 32), K.M.rubber("#1E1E1E"));
    rod.add(butt);
    var seat = new THREE.Mesh(latheX(0.02, 0.24, function () { return 0.036; }, 2, 32), K.M.metal("#2F3337", 0.3));
    rod.add(seat);
    var fore = new THREE.Mesh(latheX(0.24, 0.42, function (t) { return 0.04 - 0.01 * t; }, 8, 32), cork);
    rod.add(fore);
    [0.02, 0.24].forEach(function (x) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 10, 32), K.M.metal("#C9A74A", 0.25));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      rod.add(ring);
    });

    var chrome = K.M.metal("#DDE2E6", 0.12);
    var guides = [];
    [0.7, 1.05, 1.38, 1.68, 1.95, 2.18].forEach(function (x, i) {
      var size = 0.06 - i * 0.008;
      var ring = new THREE.Mesh(new THREE.TorusGeometry(size, 0.005, 10, 36), chrome);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 0.028 - 0.022 * x / L + size + 0.03, 0);
      rod.add(ring);
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 8), chrome);
      leg.position.set(x, 0.028 - 0.022 * x / L + 0.022, 0);
      rod.add(leg);
      guides.push(ring.position.clone());
    });
    var tip = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 20), chrome);
    tip.rotation.y = Math.PI / 2;
    tip.position.set(L, 0.018, 0);
    rod.add(tip);

    // molinete: corpo arredondado, rotor colorido, carretel com linha, alça e manivela
    var reel = new THREE.Group();
    reel.position.set(0.1, 0.03, 0);
    var gun = K.M.metal("#3A4046", 0.32);
    var stem = new THREE.Mesh(K.G.roundedBox(0.14, 0.24, 0.035, 0.016, 3), gun);
    stem.position.set(0.0, 0.13, 0);
    reel.add(stem);
    var body = new THREE.Mesh(latheX(-0.15, 0.06, function (t) {
      return 0.02 + 0.08 * Math.sqrt(Math.sin(Math.PI * (0.06 + 0.52 * t)));
    }, 24, 48), K.M.plastic("#20262B", { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
    body.position.y = 0.3;
    reel.add(body);
    var rotor = new THREE.Mesh(latheX(0.06, 0.15, function (t) { return 0.096 - 0.022 * t; }, 6, 48), K.M.metal(o.accent || "#2E8A5E", 0.24));
    rotor.position.y = 0.3;
    reel.add(rotor);
    var line = new THREE.Mesh(latheX(0.15, 0.245, function () { return 0.068; }, 2, 48), K.M.plastic("#ffffff", { map: K.T.speckle("#5FB35A", ["#3E8A3C", "#9ED48E"], 400), roughness: 0.4, bumpMap: K.T.stripes(90, true, 2), bumpScale: 0.01 }));
    line.position.y = 0.3;
    reel.add(line);
    var lip = new THREE.Mesh(latheX(0.245, 0.27, function (t) { return 0.08 - 0.03 * t; }, 4, 48), K.M.metal("#C9D0D6", 0.16));
    lip.position.y = 0.3;
    reel.add(lip);
    var bail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.005, 8, 40, Math.PI), chrome);
    bail.rotation.y = Math.PI / 2;
    bail.position.set(0.17, 0.3, 0);
    reel.add(bail);
    var arm = new THREE.Mesh(K.G.roundedBox(0.024, 0.15, 0.02, 0.008, 2), gun);
    arm.position.set(-0.04, 0.34, -0.12);
    arm.rotation.x = -0.6;
    reel.add(arm);
    var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 20), K.M.rubber("#1A1A1A"));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(-0.04, 0.4, -0.18);
    reel.add(knob);
    reel.scale.setScalar(1.15);
    rod.add(reel);

    var lineCurve = [new THREE.Vector3(0.34, 0.37, 0)].concat(guides.map(function (p) { return new THREE.Vector3(p.x, p.y - 0.01, 0); })).concat([new THREE.Vector3(L, 0.02, 0)]);
    var fishing = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lineCurve), 120, 0.0025, 6, false), new THREE.MeshStandardMaterial({ color: "#7BCB6A", roughness: 0.3, transparent: true, opacity: 0.8 }));
    fishing.userData.noShadow = true;
    rod.add(fishing);

    rod.rotation.x = -Math.PI / 2 + 0.0;
    rod.rotation.set(0, -0.55, -0.02);
    rod.position.set(-0.9, 0.05, -0.55);
    g.add(rod);

    g.userData.hotspots = [
      K.hot(-0.9 + 0.6, 0.55, -0.55 + 0.2, "Molinete incluso", "Já vem montado e com linha, pronto para usar."),
      K.hot(-0.9 - 0.2, 0.1, -0.55 - 0.1, "Cabo de cortiça", "Leve, firme e não esquenta na mão."),
      K.hot(0.5, 0.12, 0.35, "Vara de 1,65 m", "Blank de fibra, boa para rios e pesqueiros.")
    ];
    return g;
  });

  // ---------- iscas artificiais ----------
  function lure(colors, r) {
    var g = new THREE.Group();
    var L = 0.5;
    var W = 256, H = 512, c = K.canvas(W, H), ctx = c.getContext("2d");
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, colors[1]); grad.addColorStop(0.18, colors[0]); grad.addColorStop(0.32, colors[0]);
    grad.addColorStop(0.5, colors[1]); grad.addColorStop(0.68, colors[0]); grad.addColorStop(0.82, colors[0]); grad.addColorStop(1, colors[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 2;
    for (var y = 0; y < H; y += 18) {
      for (var x = (y / 18) % 2 ? 9 : 0; x < W; x += 18) {
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI); ctx.stroke();
      }
    }
    var body = new THREE.Mesh(latheX(-L / 2, L / 2, function (t) { return 0.062 * Math.pow(Math.sin(Math.PI * Math.min(0.98, 0.04 + t)), 0.6) * (1 - 0.25 * t); }, 28, 40),
      new THREE.MeshPhysicalMaterial({ map: K.tex(c), metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.6, iridescenceIOR: 1.8 }));
    body.scale.set(1, 1, 0.62);
    g.add(body);
    var lip = new THREE.Mesh(K.G.roundedBox(0.07, 0.004, 0.05, 0.002, 2), new THREE.MeshPhysicalMaterial({ color: "#EFF6F3", transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, depthWrite: false }));
    lip.position.set(-L / 2 - 0.02, -0.03, 0);
    lip.rotation.z = 0.7;
    g.add(lip);
    [-1, 1].forEach(function (side) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), K.M.plastic("#F3CF3A", { roughness: 0.2 }));
      eye.position.set(-L / 2 + 0.07, 0.012, side * 0.034);
      g.add(eye);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), K.M.plastic("#0B0B0B", { roughness: 0.1 }));
      pupil.position.set(-L / 2 + 0.072, 0.012, side * 0.046);
      g.add(pupil);
    });
    var steel = K.M.metal("#AEB5BA", 0.2);
    [-0.02, L / 2].forEach(function (x) {
      var hook = new THREE.Group();
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 8, 20), steel);
      hook.add(ring);
      var shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.07, 8), steel);
      shank.position.y = -0.045;
      hook.add(shank);
      for (var k = 0; k < 3; k++) {
        var bend = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0025, 8, 20, Math.PI * 1.25), steel);
        bend.position.y = -0.08;
        bend.rotation.set(0, (k / 3) * Math.PI * 2, Math.PI * 0.9);
        hook.add(bend);
      }
      hook.position.set(x, -0.06, 0);
      hook.rotation.z = x > 0 ? -0.9 : 0.15;
      g.add(hook);
    });
    return g;
  }

  P.register("lures", function (o) {
    var r = K.rng(o.seed || 61);
    var g = new THREE.Group();
    var palette = [["#1F5F8B", "#E8F1F2"], ["#2E5E3E", "#F3CF6A"], ["#B4506A", "#FCE9EE"], ["#E98B2A", "#FFF3D6"], ["#34383C", "#D9DDE0"]];
    palette.forEach(function (colors, i) {
      var l = lure(colors, r);
      // deitada de lado, como numa bancada, em leque
      l.rotation.order = "YXZ";
      l.rotation.set(Math.PI / 2, -0.7 + i * 0.35, 0);
      l.position.set(-0.56 + i * 0.28, 0.042, i % 2 ? 0.12 : -0.12);
      g.add(l);
    });
    g.userData.hotspots = [
      K.hot(0, 0.15, 0.1, "5 modelos", "Cores para água limpa e turva."),
      K.hot(0.52, 0.12, -0.2, "Garatéias de aço", "Anzóis triplos resistentes à ferrugem."),
      K.hot(-0.55, 0.14, -0.15, "Barbela de mergulho", "Faz a isca nadar como um peixinho de verdade.")
    ];
    return g;
  });

  // ---------- ferramentas de jardim ----------
  function handle(woodColor) {
    var g = new THREE.Group();
    var wood = K.M.plastic("#ffffff", { map: K.T.wood(woodColor || "#A8733F"), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.4 });
    g.add(new THREE.Mesh(latheX(-0.62, 0, function (t) {
      return 0.042 + 0.012 * Math.sin(t * Math.PI * 1.1) - (t > 0.92 ? (t - 0.92) * 0.15 : 0) + (t < 0.06 ? (0.06 - t) * -0.2 : 0);
    }, 36, 36), wood));
    var ferrule = new THREE.Mesh(latheX(-0.02, 0.1, function (t) { return 0.04 - 0.012 * t; }, 6, 36), K.M.metal("#C5CBD0", 0.28, { bumpMap: K.T.stripes(200, false, 1), bumpScale: 0.002 }));
    g.add(ferrule);
    var loop = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 30), K.M.matte("#6B4A2E"));
    loop.position.set(-0.66, 0, 0);
    loop.rotation.x = Math.PI / 2;
    g.add(loop);
    return g;
  }

  P.register("tools", function (o) {
    var g = new THREE.Group();
    var steel = K.M.metal("#C3C9CD", 0.3, { bumpMap: K.T.noise(41, 2), bumpScale: 0.003 });
    var paint = K.M.plastic(o.color || "#2E5E3E", { roughness: 0.35, clearcoat: 0.8 });

    var trowel = new THREE.Group();
    trowel.add(handle(o.wood));
    var s = new THREE.Shape();
    s.moveTo(-0.12, 0);
    s.quadraticCurveTo(-0.14, 0.26, 0, 0.44);
    s.quadraticCurveTo(0.14, 0.26, 0.12, 0);
    s.lineTo(-0.12, 0);
    var blade = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24 });
    var bp = blade.attributes.position;
    for (var i = 0; i < bp.count; i++) {
      var x = bp.getX(i), y = bp.getY(i);
      bp.setZ(i, bp.getZ(i) + 2.4 * x * x * (0.6 + 0.4 * (1 - y / 0.44)));
    }
    blade.computeVertexNormals();
    var bladeMesh = new THREE.Mesh(blade, o.painted ? paint : steel);
    bladeMesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    bladeMesh.position.set(0.14, -0.03, 0);
    trowel.add(bladeMesh);
    var neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.08, 0, 0), new THREE.Vector3(0.12, -0.015, 0), new THREE.Vector3(0.17, -0.03, 0)
    ]), 12, 0.012, 10, false), steel);
    trowel.add(neck);
    trowel.position.set(-0.05, 0.05, 0.28);
    trowel.rotation.y = 0.28;
    g.add(trowel);

    var fork = new THREE.Group();
    fork.add(handle(o.wood));
    var fneck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.1, 12), steel);
    fneck.rotation.z = Math.PI / 2;
    fneck.position.x = 0.14;
    fork.add(fneck);
    [-1, 0, 1].forEach(function (k) {
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(0.24, -0.005, k * 0.06),
        new THREE.Vector3(0.42, -0.02, k * 0.075), new THREE.Vector3(0.52, -0.05, k * 0.075)
      ]);
      fork.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.009, 10, false), steel));
      var point = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.04, 10), steel);
      point.rotation.z = -Math.PI / 2 - 0.35;
      point.position.set(0.535, -0.062, k * 0.075);
      fork.add(point);
    });
    fork.position.set(0.05, 0.05, -0.2);
    fork.rotation.y = -0.22;
    g.add(fork);

    var rake = new THREE.Group();
    rake.add(handle(o.wood));
    var bar = new THREE.Mesh(K.G.roundedBox(0.03, 0.02, 0.3, 0.008, 2), steel);
    bar.position.set(0.2, -0.01, 0);
    rake.add(bar);
    for (var t = 0; t < 5; t++) {
      var tine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.2, -0.01, -0.12 + t * 0.06), new THREE.Vector3(0.3, -0.02, -0.12 + t * 0.06), new THREE.Vector3(0.34, -0.06, -0.12 + t * 0.06)
      ]), 12, 0.007, 8, false), steel);
      rake.add(tine);
    }
    var neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 12), steel);
    neck2.rotation.z = Math.PI / 2;
    neck2.position.x = 0.14;
    rake.add(neck2);
    rake.position.set(0.0, 0.05, -0.62);
    rake.rotation.y = -0.05;
    g.add(rake);

    g.userData.hotspots = [
      K.hot(0.3, 0.1, 0.3, "Pá de aço", "Lâmina côncava que não entorta ao cavar."),
      K.hot(-0.45, 0.12, 0.45, "Cabo de madeira", "Envernizado, confortável para a mão."),
      K.hot(0.55, 0.08, -0.26, "Garfo e rastelo", "Soltar a terra e juntar folhas.")
    ];
    return g;
  });
})();
