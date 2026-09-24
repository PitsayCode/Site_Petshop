// Bosque Pet — motor 3D dos produtos (Three.js r147)
//
// - Iluminação de estúdio com mapa de ambiente (reflexos reais em metal,
//   plástico e vidro), tone mapping ACES e sombras suaves.
// - Materiais PBR: plástico com verniz, feltro com "sheen", inox, vidro.
// - Viewer: vitrine interativa com pontos de destaque (hotspots).
// - renderThumb: "fotografa" cada produto para os cards do catálogo.

(function () {
  "use strict";

  var THREE = window.THREE;
  if (!THREE) return;
  var V3 = THREE.Vector3;
  // cores em hexadecimal passam a ser tratadas como sRGB (evita tons "lavados")
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  // ================= utilitários =================
  function rng(seed) {
    var a = (seed || 1) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function smoothstep(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  function tex(c, o) {
    o = o || {};
    var t = new THREE.CanvasTexture(c);
    if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
    if (o.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(o.repeat[0], o.repeat[1]);
    }
    t.anisotropy = o.anisotropy || 8;
    return t;
  }
  var cache = {};
  function shared(key, make) {
    if (!cache[key]) {
      cache[key] = make();
      cache[key].userData.shared = true;
    }
    return cache[key];
  }
  function shade(hex, amount) {
    var c = new THREE.Color(hex);
    var hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
    return "#" + c.getHexString();
  }

  // ================= texturas procedurais =================
  function valueNoiseCanvas(size, seed, octaves, base) {
    var r = rng(seed);
    var c = canvas(size, size), ctx = c.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    for (var o = 0; o < octaves; o++) {
      var n = (base || 4) << o;
      if (n > size) break;
      var small = canvas(n, n), sctx = small.getContext("2d");
      var img = sctx.createImageData(n, n);
      for (var i = 0; i < n * n; i++) {
        var v = r() * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      sctx.putImageData(img, 0, 0);
      ctx.globalAlpha = 0.55 / (1 + o * 0.5);
      ctx.drawImage(small, 0, 0, size, size);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  var T = {
    noise: function (seed, repeat) {
      return shared("noise" + (seed || 1) + (repeat || 1), function () {
        return tex(valueNoiseCanvas(512, seed || 1, 7, 4), { srgb: false, repeat: [repeat || 1, repeat || 1] });
      });
    },
    fuzz: function () {
      return shared("fuzz", function () {
        var size = 512, c = canvas(size, size), ctx = c.getContext("2d");
        var img = ctx.createImageData(size, size), r = rng(7);
        for (var i = 0; i < size * size; i++) {
          var v = 90 + r() * 165;
          img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
          img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return tex(c, { srgb: false, repeat: [3, 3] });
      });
    },
    // listras suaves (costelas, frisos, crimpagem). horizontal = listras ao longo de v
    stripes: function (count, horizontal, sharpness) {
      return shared("stripes" + count + horizontal + sharpness, function () {
        var size = 512, c = canvas(size, size), ctx = c.getContext("2d");
        var img = ctx.createImageData(size, size);
        for (var y = 0; y < size; y++) {
          for (var x = 0; x < size; x++) {
            var p = (horizontal ? y : x) / size * count * Math.PI * 2;
            var v = Math.pow(0.5 + 0.5 * Math.sin(p), sharpness || 1) * 255;
            var i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        return tex(c, { srgb: false });
      });
    },
    woven: function () {
      return shared("woven", function () {
        var size = 256, c = canvas(size, size), ctx = c.getContext("2d");
        ctx.fillStyle = "#777"; ctx.fillRect(0, 0, size, size);
        var cell = 16;
        for (var y = 0; y < size; y += cell) {
          for (var x = 0; x < size; x += cell) {
            var odd = ((x + y) / cell) % 2 === 0;
            var g = ctx.createLinearGradient(x, y, odd ? x + cell : x, odd ? y : y + cell);
            g.addColorStop(0, "#555"); g.addColorStop(0.5, "#eee"); g.addColorStop(1, "#555");
            ctx.fillStyle = g;
            ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          }
        }
        return tex(c, { srgb: false, repeat: [14, 14] });
      });
    },
    wood: function (color) {
      return shared("wood" + color, function () {
        var w = 256, h = 1024, c = canvas(w, h), ctx = c.getContext("2d"), r = rng(11);
        ctx.fillStyle = color || "#9A6A3F"; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < 70; i++) {
          var x0 = r() * w, amp = 4 + r() * 10, freq = 0.004 + r() * 0.01;
          ctx.strokeStyle = "rgba(" + (r() < 0.5 ? "60,35,15," : "255,225,180,") + (0.08 + r() * 0.18) + ")";
          ctx.lineWidth = 1 + r() * 3;
          ctx.beginPath();
          for (var y = 0; y <= h; y += 8) {
            var x = x0 + Math.sin(y * freq + i) * amp;
            if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        return tex(c, {});
      });
    },
    speckle: function (base, dots, density) {
      return shared("speckle" + base + dots.join() + density, function () {
        var size = 512, c = canvas(size, size), ctx = c.getContext("2d"), r = rng(5);
        ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 0.25;
        ctx.drawImage(valueNoiseCanvas(size, 3, 6, 4), 0, 0);
        ctx.globalAlpha = 1;
        for (var i = 0; i < (density || 900); i++) {
          ctx.fillStyle = dots[Math.floor(r() * dots.length)];
          ctx.globalAlpha = 0.25 + r() * 0.5;
          ctx.beginPath();
          ctx.arc(r() * size, r() * size, 0.6 + r() * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return tex(c, { repeat: [2, 2] });
      });
    },
    contact: function () {
      return shared("contact", function () {
        var size = 256, c = canvas(size, size), ctx = c.getContext("2d");
        var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, "rgba(20,30,18,0.4)");
        g.addColorStop(0.45, "rgba(20,30,18,0.14)");
        g.addColorStop(1, "rgba(20,30,18,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
        return tex(c, {});
      });
    }
  };

  // ================= materiais =================
  function pick(o, k, d) { return o && o[k] !== undefined ? o[k] : d; }
  var M = {
    plastic: function (color, o) {
      return new THREE.MeshPhysicalMaterial({
        color: color, map: pick(o, "map", null),
        roughness: pick(o, "roughness", 0.42), metalness: 0,
        clearcoat: pick(o, "clearcoat", 0.7), clearcoatRoughness: pick(o, "clearcoatRoughness", 0.22),
        bumpMap: pick(o, "bumpMap", null), bumpScale: pick(o, "bumpScale", 0.02),
        side: pick(o, "side", THREE.FrontSide)
      });
    },
    matte: function (color, o) {
      return new THREE.MeshStandardMaterial({
        color: color, map: pick(o, "map", null), roughness: pick(o, "roughness", 0.88), metalness: 0,
        bumpMap: pick(o, "bumpMap", null), bumpScale: pick(o, "bumpScale", 0.03),
        side: pick(o, "side", THREE.FrontSide)
      });
    },
    metal: function (color, roughness, o) {
      return new THREE.MeshStandardMaterial({
        color: color, metalness: 1, roughness: roughness === undefined ? 0.22 : roughness,
        bumpMap: pick(o, "bumpMap", null), bumpScale: pick(o, "bumpScale", 0.01)
      });
    },
    fabric: function (color, o) {
      return new THREE.MeshPhysicalMaterial({
        color: color, map: pick(o, "map", null), roughness: pick(o, "roughness", 0.95), metalness: 0,
        sheen: pick(o, "sheen", 0.45), sheenRoughness: pick(o, "sheenRoughness", 0.5),
        sheenColor: new THREE.Color(pick(o, "sheenColor", color)),
        bumpMap: pick(o, "bumpMap", T.fuzz()), bumpScale: pick(o, "bumpScale", 0.02)
      });
    },
    glass: function (o) {
      return new THREE.MeshPhysicalMaterial({
        color: pick(o, "color", 0xffffff), metalness: 0, roughness: pick(o, "roughness", 0.04),
        transmission: pick(o, "transmission", 1), thickness: pick(o, "thickness", 0.05),
        ior: pick(o, "ior", 1.5), specularIntensity: 1,
        attenuationColor: new THREE.Color(pick(o, "attenuationColor", 0xffffff)),
        attenuationDistance: pick(o, "attenuationDistance", 0),
        side: pick(o, "side", THREE.FrontSide), transparent: pick(o, "transparent", false),
        opacity: pick(o, "opacity", 1)
      });
    },
    rubber: function (color, o) {
      return new THREE.MeshStandardMaterial({
        color: color, roughness: pick(o, "roughness", 0.75), metalness: 0,
        bumpMap: pick(o, "bumpMap", T.noise(9, 4)), bumpScale: pick(o, "bumpScale", 0.01)
      });
    }
  };

  // ================= geometria =================
  var G = {
    // caixa arredondada com UV planar frontal (0..1), boa para rótulos
    roundedBox: function (w, h, d, r, seg) {
      r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
      seg = seg || 6;
      var x = -w / 2 + r, y = -h / 2 + r, iw = w - 2 * r, ih = h - 2 * r;
      var s = new THREE.Shape();
      s.moveTo(x, y);
      s.lineTo(x + iw, y);
      s.lineTo(x + iw, y + ih);
      s.lineTo(x, y + ih);
      s.lineTo(x, y);
      var geo = new THREE.ExtrudeGeometry(s, {
        depth: Math.max(0.0001, d - 2 * r), bevelEnabled: true, bevelSegments: seg,
        bevelSize: r, bevelThickness: r, curveSegments: seg, steps: 1
      });
      geo.translate(0, 0, -(d - 2 * r) / 2);
      var pos = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
      }
      geo.computeVertexNormals();
      return geo;
    }
  };

  function addBounds(group, min, max) {
    var size = new V3(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    var m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    m.visible = false;
    m.userData.bounds = true;
    group.add(m);
    return m;
  }

  function hot(x, y, z, title, text) {
    return { p: new V3(x, y, z), title: title, text: text };
  }

  // ================= desenhos para rótulos =================
  var SIL = {
    dog: "M60 190 L60 120 C55 95 60 75 75 65 L80 40 C80 30 88 22 98 22 L118 22 C128 22 132 30 140 34 L160 42 C168 46 166 58 156 60 L135 62 C130 64 128 70 128 78 L130 95 C150 105 160 130 160 160 L162 190 Z M92 26 C80 30 76 48 82 62 C90 56 96 42 100 30 Z M60 150 C40 150 30 130 32 110 C38 128 48 138 62 138 Z",
    cat: "M70 190 C60 160 62 120 80 100 C72 90 70 75 74 62 L70 30 L92 50 C100 47 110 47 118 50 L140 30 L136 62 C140 76 138 90 130 100 C148 120 150 160 140 190 Z M140 185 C175 185 185 150 170 130 C172 150 165 170 138 172 Z",
    puppy: "M70 190 C62 150 66 120 84 108 C70 98 64 80 70 62 C76 40 96 30 116 32 C140 34 154 52 152 74 C150 92 140 102 128 108 C146 120 150 150 142 190 Z M72 58 C56 58 48 80 58 98 C66 90 72 76 76 64 Z M146 56 C162 56 170 78 160 96 C152 88 146 74 142 62 Z",
    fish: "M30 100 C60 50 130 50 160 100 C130 150 60 150 30 100 Z M160 100 L195 70 L188 100 L195 130 Z",
    sprout: "M96 190 L96 110 L104 110 L104 190 Z M100 120 C70 120 40 100 36 60 C76 60 98 84 100 120 Z M100 105 C104 70 130 44 170 44 C168 84 136 106 100 105 Z",
    paw: "M100 170 C75 170 56 156 56 138 C56 125 66 118 76 112 C80 110 82 106 81 102 L78 92 C76 85 83 79 90 82 L100 87 C104 89 108 89 112 87 L122 82 C128 79 135 85 133 92 L130 102 C129 106 131 110 135 112 C145 118 155 125 155 138 C155 156 125 170 100 170 Z M72 60 A14 14 0 1 0 72.1 60 Z M128 60 A14 14 0 1 0 128.1 60 Z M38 88 A12 12 0 1 0 38.1 88 Z M162 88 A12 12 0 1 0 162.1 88 Z"
  };
  var paths = {};
  var draw = {
    roundRect: function (ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    // silhueta em caixa 200x200 centralizada em (cx, cy) com tamanho s
    silhouette: function (ctx, name, cx, cy, s, fill) {
      if (!window.Path2D || !SIL[name]) return;
      paths[name] = paths[name] || new Path2D(SIL[name]);
      ctx.save();
      ctx.translate(cx - s / 2, cy - s / 2);
      ctx.scale(s / 200, s / 200);
      ctx.fillStyle = fill;
      ctx.fill(paths[name], "evenodd");
      ctx.restore();
    },
    leaf: function (ctx, x, y, s, rot, fill) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.6, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.6, 0, 0, -s);
      ctx.fill();
      ctx.restore();
    },
    kibbles: function (ctx, cx, cy, w, h, color, r) {
      for (var i = 0; i < 90; i++) {
        var a = r() * Math.PI * 2, d = Math.sqrt(r());
        var x = cx + Math.cos(a) * d * w / 2, y = cy + Math.sin(a) * d * h / 2 - (1 - d) * h * 0.35;
        var rad = w * (0.028 + r() * 0.012);
        var g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.4, rad * 0.1, x, y, rad);
        g.addColorStop(0, shade(color, 0.18)); g.addColorStop(1, shade(color, -0.12));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, Math.PI * 2); ctx.fill();
      }
    },
    barcode: function (ctx, x, y, w, h, r) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - 10, y - 10, w + 20, h + 40);
      ctx.fillStyle = "#111";
      var px = x;
      while (px < x + w) {
        var bw = 2 + Math.floor(r() * 4);
        if (r() > 0.4) ctx.fillRect(px, y, bw, h);
        px += bw + 2;
      }
      ctx.font = "700 " + Math.round(h * 0.22) + "px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("7 891234 567890", x + w / 2, y + h + 24);
    },
    text: function (ctx, str, x, y, font, fill, o) {
      o = o || {};
      ctx.font = font;
      ctx.fillStyle = fill;
      ctx.textAlign = o.align || "center";
      ctx.textBaseline = o.baseline || "alphabetic";
      if ("letterSpacing" in ctx) ctx.letterSpacing = o.spacing || "0px";
      if (o.maxWidth) ctx.fillText(str, x, y, o.maxWidth); else ctx.fillText(str, x, y);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    }
  };

  // ================= ambiente / estúdio =================
  var envByRenderer = new WeakMap();
  function environment(renderer) {
    if (envByRenderer.has(renderer)) return envByRenderer.get(renderer);
    var scene = new THREE.Scene();
    var room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0x7b7c74, roughness: 1 }));
    room.scale.set(24, 14, 24);
    room.position.y = 5;
    scene.add(room);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x34362f, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.9;
    scene.add(floor);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    function panel(w, h, x, y, z, intensity, color) {
      var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color || 0xffffff).multiplyScalar(intensity) });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      m.lookAt(0, 1, 0);
      scene.add(m);
    }
    panel(10, 10, 0, 11.5, 0, 4);            // softbox superior
    panel(5, 7, -9, 5, 4, 7);                // softbox lateral esquerda
    panel(5, 7, 9, 4, 6, 3.5, 0xfff0d8);     // lateral quente
    panel(1.2, 9, 6, 5, -7, 9);              // faixa estreita: brilho em metal e verniz
    panel(12, 3, 0, 2, -11, 1.6, 0xcfe8c8);  // rebatedor verde (natureza)
    panel(6, 3, 3, 1.5, 11, 2.2);            // frontal suave
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envTex = pmrem.fromScene(scene, 0.04).texture;
    pmrem.dispose();
    envByRenderer.set(renderer, envTex);
    return envTex;
  }

  function studio(scene) {
    scene.add(new THREE.HemisphereLight(0xfbfff4, 0x5f7a4f, 0.35));
    var key = new THREE.DirectionalLight(0xfff3df, 1.6);
    key.position.set(3.2, 6.5, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 5;
    scene.add(key);
    scene.add(key.target);
    var rim = new THREE.DirectionalLight(0xe8f5e0, 0.7);
    rim.position.set(-4, 3.5, -4.5);
    scene.add(rim);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    var contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.contact(), transparent: true, depthWrite: false, toneMapped: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.002;
    contact.renderOrder = -1;
    scene.add(contact);

    return {
      fit: function (size) {
        var s = Math.max(size.x, size.z, size.y) * 0.9;
        var cam = key.shadow.camera;
        cam.left = cam.bottom = -s * 1.4;
        cam.right = cam.top = s * 1.4;
        cam.near = 0.1; cam.far = 30;
        cam.updateProjectionMatrix();
        contact.scale.set(size.x * 1.15 + 0.25, size.z * 1.15 + 0.25, 1);
      }
    };
  }

  function makeRenderer(preserve) {
    var r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!preserve, powerPreference: "high-performance" });
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    return r;
  }

  // ================= construção dos modelos =================
  var builders = {};
  var K = {
    THREE: THREE, rng: rng, smoothstep: smoothstep, canvas: canvas, tex: tex, shared: shared, shade: shade,
    T: T, M: M, G: G, draw: draw, addBounds: addBounds, hot: hot
  };
  function register(kind, fn) { builders[kind] = fn; }

  function build(def, variantOpts) {
    var fn = builders[def.kind];
    if (!fn) throw new Error("Modelo 3D desconhecido: " + def.kind);
    var opts = Object.assign({}, def.opts || {}, variantOpts || {});
    var group = fn(opts, K);
    group.traverse(function (o) {
      if (o.isMesh && !o.userData.bounds) {
        var m = Array.isArray(o.material) ? o.material[0] : o.material;
        var seeThrough = !!(m && (m.transparent || m.transmission > 0));
        o.castShadow = !(o.userData.noShadow || seeThrough);
        o.receiveShadow = !(seeThrough || o.userData.noReceive);
      }
    });
    return group;
  }

  // caixa envolvente sem InstancedMesh (o Box3 padrão usa a geometria base,
  // ignorando onde cada instância está, e deixaria o produto "flutuando")
  function computeBox(object) {
    object.updateMatrixWorld(true);
    var box = new THREE.Box3(), part = new THREE.Box3();
    object.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(part);
    });
    return box;
  }

  function fit(object, target) {
    var box = computeBox(object);
    var size = box.getSize(new V3());
    var s = target / Math.max(size.x, size.y, size.z);
    object.scale.multiplyScalar(s);
    box = computeBox(object);
    var c = box.getCenter(new V3());
    object.position.x -= c.x;
    object.position.z -= c.z;
    object.position.y -= box.min.y;
    return computeBox(object);
  }

  var TEX_KEYS = ["map", "bumpMap", "normalMap", "roughnessMap", "alphaMap", "emissiveMap", "sheenColorMap", "clearcoatMap", "transmissionMap"];
  function dispose(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) {
        TEX_KEYS.forEach(function (k) {
          if (m[k] && !m[k].userData.shared) m[k].dispose();
        });
        m.dispose();
      });
    });
  }

  var fontsReady = (function () {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var loads = Promise.all([
      document.fonts.load("600 64px Fredoka"),
      document.fonts.load("800 32px Nunito"),
      document.fonts.load("700 32px Nunito")
    ]).catch(function () {});
    return Promise.race([loads, new Promise(function (r) { setTimeout(r, 2500); })]);
  })();

  // ================= Viewer (vitrine interativa) =================
  function Viewer(container, options) {
    options = options || {};
    var self = this;
    this.container = container;
    this.options = options;
    this.renderer = makeRenderer(false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.environment = environment(this.renderer);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    this.studio = studio(this.scene);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.model = null;
    this.hotspots = [];
    this.clock = new THREE.Clock();
    this.visible = true;
    this.intro = 1;

    if (THREE.OrbitControls) {
      var c = this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      c.enableDamping = true;
      c.dampingFactor = 0.08;
      c.enablePan = false;
      c.rotateSpeed = 0.7;
      c.zoomSpeed = 0.8;
      c.minPolarAngle = 0.2;
      c.maxPolarAngle = Math.PI * 0.48;
      c.autoRotate = options.autoRotate !== false;
      c.autoRotateSpeed = 0.9;
      var idle;
      c.addEventListener("start", function () {
        c.autoRotate = false;
        clearTimeout(idle);
        container.classList.add("interacting");
      });
      c.addEventListener("end", function () {
        container.classList.remove("interacting");
        idle = setTimeout(function () { c.autoRotate = options.autoRotate !== false; }, 6000);
      });
    }

    this.layer = document.createElement("div");
    this.layer.className = "hotspots";
    container.appendChild(this.layer);

    function resize() {
      var w = container.clientWidth || 1, h = container.clientHeight || 1;
      self.renderer.setSize(w, h, false);
      self.camera.aspect = w / h;
      self.camera.updateProjectionMatrix();
    }
    this.resize = resize;
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
    window.addEventListener("resize", resize);
    resize();

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }).observe(container);
    }

    (function loop() {
      self.raf = requestAnimationFrame(loop);
      if (!self.visible || document.hidden) return;
      self.tick();
    })();
  }

  Viewer.prototype.show = function (product, variantIndex) {
    var def = product.model;
    var variant = def.variants && def.variants[variantIndex || 0];
    if (this.model) {
      this.pivot.remove(this.model);
      dispose(this.model);
    }
    var model = build(def, variant && variant.opts);
    var box = fit(model, 2);
    this.pivot.add(model);
    this.model = model;

    var size = box.getSize(new V3());
    this.size = size;
    this.center = box.getCenter(new V3());
    this.studio.fit(size);

    var radius = size.length() / 2;
    var dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (def.zoom || 1.0);
    var dir = new V3(0.95, 0.5, 1.55).normalize();
    this.home = {
      target: new V3(0, size.y * 0.46, 0),
      position: new V3(0, size.y * 0.46, 0).add(dir.multiplyScalar(dist))
    };
    if (!this.hasFramed || !this.controls) {
      this.camera.position.copy(this.home.position);
      this.hasFramed = true;
    }
    this.flyHome();
    if (this.controls) {
      this.controls.minDistance = dist * 0.45;
      this.controls.maxDistance = dist * 1.7;
    }

    this.buildHotspots(model.userData.hotspots || []);
    this.intro = 0;
    this.tick();
  };

  Viewer.prototype.flyHome = function () {
    this.fly = { t: 0, fromP: this.camera.position.clone(), fromT: this.controls ? this.controls.target.clone() : this.home.target.clone() };
  };

  Viewer.prototype.buildHotspots = function (list) {
    var self = this;
    this.layer.innerHTML = "";
    this.hotspots = list.map(function (h, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hotspot";
      b.setAttribute("aria-label", h.title + ": " + h.text);
      var tip = document.createElement("span");
      tip.className = "hotspot-tip";
      var strong = document.createElement("b");
      strong.textContent = h.title;
      tip.appendChild(strong);
      tip.appendChild(document.createTextNode(h.text));
      b.appendChild(tip);
      b.addEventListener("click", function () {
        var open = b.classList.contains("open");
        Array.prototype.forEach.call(self.layer.children, function (x) { x.classList.remove("open"); });
        b.classList.toggle("open", !open);
      });
      self.layer.appendChild(b);
      b.style.animationDelay = (0.6 + i * 0.15) + "s";
      return { el: b, p: h.p };
    });
  };

  var tmp = new V3(), tmp2 = new V3();
  Viewer.prototype.tick = function () {
    var dt = Math.min(this.clock.getDelta(), 0.05);
    var t = this.clock.elapsedTime;

    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt * 1.8);
      var e = 1 - Math.pow(1 - this.intro, 3);
      this.pivot.scale.setScalar(0.85 + 0.15 * e);
      this.pivot.rotation.y = (1 - e) * -0.6;
      this.renderer.domElement.style.opacity = String(0.2 + 0.8 * e);
    }
    if (this.fly && this.home) {
      this.fly.t = Math.min(1, this.fly.t + dt * 1.6);
      var k = 1 - Math.pow(1 - this.fly.t, 3);
      this.camera.position.lerpVectors(this.fly.fromP, this.home.position, k);
      if (this.controls) this.controls.target.lerpVectors(this.fly.fromT, this.home.target, k);
      else this.camera.lookAt(this.home.target);
      if (this.fly.t >= 1) this.fly = null;
    }
    if (this.model && this.model.userData.update) this.model.userData.update(t, dt);
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateHotspots();
  };

  Viewer.prototype.updateHotspots = function () {
    if (!this.model || !this.hotspots.length) return;
    var w = this.container.clientWidth, h = this.container.clientHeight;
    var center = tmp2.set(0, this.size.y * 0.5, 0);
    for (var i = 0; i < this.hotspots.length; i++) {
      var hs = this.hotspots[i];
      var world = this.model.localToWorld(tmp.copy(hs.p));
      var outward = world.clone().sub(center).normalize();
      var toCam = this.camera.position.clone().sub(world).normalize();
      var facing = outward.dot(toCam) > 0.05;
      world.project(this.camera);
      hs.el.style.transform = "translate(" + ((world.x * 0.5 + 0.5) * w) + "px," + ((-world.y * 0.5 + 0.5) * h) + "px)";
      hs.el.classList.toggle("behind", !facing);
    }
  };

  Viewer.prototype.reset = function () {
    if (this.controls) this.controls.autoRotate = this.options.autoRotate !== false;
    this.flyHome();
  };

  // ================= fotos dos produtos (thumbnails) =================
  var thumb = null, queue = Promise.resolve(), thumbCache = {};
  function thumbStage() {
    if (thumb) return thumb;
    var renderer = makeRenderer(true);
    renderer.setPixelRatio(1);
    renderer.setSize(720, 580, false);
    var scene = new THREE.Scene();
    scene.environment = environment(renderer);
    thumb = { renderer: renderer, scene: scene, camera: new THREE.PerspectiveCamera(28, 720 / 580, 0.05, 100), studio: studio(scene) };
    return thumb;
  }

  function renderThumb(product, variantIndex) {
    var key = product.id + ":" + (variantIndex || 0);
    if (thumbCache[key]) return thumbCache[key];
    thumbCache[key] = queue = queue.then(function () { return fontsReady; }).then(function () {
      return new Promise(function (resolve) { setTimeout(resolve, 16); });
    }).then(function () {
      var st = thumbStage();
      var def = product.model;
      var variant = def.variants && def.variants[variantIndex || 0];
      var model = build(def, variant && variant.opts);
      var box = fit(model, 2);
      st.scene.add(model);
      if (model.userData.update) model.userData.update(1.7, 0);
      var size = box.getSize(new V3());
      st.studio.fit(size);
      var radius = size.length() / 2;
      var dist = radius / Math.sin(THREE.MathUtils.degToRad(st.camera.fov / 2)) * (def.thumbZoom || 0.92);
      var target = new V3(0, size.y * 0.44, 0);
      st.camera.position.copy(target).add(new V3(0.9, 0.55, 1.6).normalize().multiplyScalar(dist));
      st.camera.lookAt(target);
      st.renderer.render(st.scene, st.camera);
      var url = st.renderer.domElement.toDataURL("image/webp", 0.9);
      st.scene.remove(model);
      dispose(model);
      return url;
    });
    // uma foto com erro não pode travar a fila das seguintes
    queue = queue.catch(function (err) {
      if (window.console) console.warn("Pet3D: falha ao gerar foto de " + product.id, err);
      return null;
    });
    thumbCache[key] = thumbCache[key].catch(function () { return null; });
    return thumbCache[key];
  }

  window.Pet3D = {
    THREE: THREE,
    K: K,
    register: register,
    build: build,
    Viewer: Viewer,
    renderThumb: renderThumb,
    fontsReady: fontsReady,
    supported: (function () {
      try {
        var c = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
      } catch (e) { return false; }
    })()
  };
})();
