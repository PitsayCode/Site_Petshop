// Pet Tem Home — criptografia (Web Crypto API nativa do navegador)
//
// Modelo de proteção:
//  1. Senha      -> nunca é armazenada. Vira um hash PBKDF2-SHA256 (600 mil
//                   iterações + salt aleatório). É irreversível: ninguém
//                   consegue "descriptografar" uma senha, nem o dono do site.
//  2. Cadastro   -> nome, e-mail, telefone e endereço são cifrados com
//                   AES-256-GCM usando uma chave derivada da senha da própria
//                   cliente. Sem a senha dela, o banco guarda só bytes
//                   aleatórios (modelo "conhecimento zero").
//  3. Comanda    -> os dados necessários para a entrega são lacrados com a
//                   chave PÚBLICA do painel da loja (ECDH P-256 + HKDF +
//                   AES-256-GCM). Só o computador do painel, que guarda a
//                   chave PRIVADA não exportável, consegue abrir.
//  4. E-mail     -> para achar a conta no login, guardamos apenas um índice
//                   derivado (PBKDF2) do e-mail, nunca o e-mail em si.

(function () {
  "use strict";

  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  var PBKDF2_ITERATIONS = 600000;
  var EMAIL_INDEX_ITERATIONS = 100000;
  var EMAIL_INDEX_SALT = "pettemhome:email-index:v1";
  var HKDF_INFO = "pettemhome:comanda:v1";

  function assertSupport() {
    if (!subtle) {
      throw new Error("Este navegador não suporta criptografia segura. Abra o site por https:// ou http://localhost.");
    }
  }

  // ---------- utilitários ----------
  function toB64(buf) {
    var bytes = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(b64) {
    var s = atob(b64);
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  function randomBytes(n) {
    return window.crypto.getRandomValues(new Uint8Array(n));
  }
  function randomId(prefix) {
    return (prefix || "") + toB64(randomBytes(12)).replace(/[+/=]/g, "").slice(0, 16);
  }
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // ---------- senha e chave da cliente ----------
  async function deriveUserKeys(password, saltB64) {
    assertSupport();
    var base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    var bits = new Uint8Array(await subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
      base, 512
    ));
    // Metade 1: prova de senha (armazenada só como SHA-256 dela)
    var verifier = toB64(await subtle.digest("SHA-256", bits.slice(0, 32)));
    // Metade 2: chave AES que abre o cadastro — marcada como NÃO exportável
    var encKey = await subtle.importKey("raw", bits.slice(32, 64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    bits.fill(0);
    return { verifier: verifier, encKey: encKey };
  }

  async function emailIndex(email) {
    assertSupport();
    var normalized = String(email || "").trim().toLowerCase();
    var base = await subtle.importKey("raw", enc.encode(normalized), "PBKDF2", false, ["deriveBits"]);
    var bits = await subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(EMAIL_INDEX_SALT), iterations: EMAIL_INDEX_ITERATIONS },
      base, 256
    );
    return toB64(bits);
  }

  async function encryptWithKey(key, data) {
    var iv = randomBytes(12);
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(data)));
    return { v: 1, alg: "AES-256-GCM", iv: toB64(iv), ct: toB64(ct) };
  }

  async function decryptWithKey(key, box) {
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return JSON.parse(dec.decode(pt));
  }

  // ---------- chave do painel da loja ----------
  async function generateStoreKeyPair() {
    assertSupport();
    // extractable = false: a chave privada não pode ser lida nem copiada por script
    var pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    var publicJwk = await subtle.exportKey("jwk", pair.publicKey);
    return { privateKey: pair.privateKey, publicJwk: publicJwk };
  }

  async function sharedAesKey(privateKey, publicKey, usage) {
    var secret = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    var hkdfBase = await subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(HKDF_INFO) },
      hkdfBase, { name: "AES-GCM", length: 256 }, false, [usage]
    );
  }

  function importPublicJwk(jwk) {
    return subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  }

  async function sealForStore(data, storePublicJwk) {
    assertSupport();
    var storePub = await importPublicJwk(storePublicJwk);
    var eph = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    var key = await sharedAesKey(eph.privateKey, storePub, "encrypt");
    var iv = randomBytes(12);
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(data)));
    return {
      v: 1,
      alg: "ECDH-P256+HKDF-SHA256+AES-256-GCM",
      epk: await subtle.exportKey("jwk", eph.publicKey),
      iv: toB64(iv),
      ct: toB64(ct)
    };
  }

  async function openSealed(box, storePrivateKey) {
    var ephPub = await importPublicJwk(box.epk);
    var key = await sharedAesKey(storePrivateKey, ephPub, "decrypt");
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return JSON.parse(dec.decode(pt));
  }

  // ---------- cofre da loja (chave privada protegida por senha) ----------
  // A chave privada é gerada no painel, cifrada com uma chave derivada da
  // "senha do cofre" (PBKDF2 600 mil + AES-256-GCM) e só então enviada ao
  // banco. Sem a senha, o banco guarda apenas bytes sem sentido.
  async function generateVaultKeyPair() {
    assertSupport();
    var pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    return {
      publicJwk: await subtle.exportKey("jwk", pair.publicKey),
      pkcs8: await subtle.exportKey("pkcs8", pair.privateKey)
    };
  }

  async function passphraseKey(passphrase, salt, iterations) {
    var base = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iterations },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }

  async function wrapPrivateKey(pkcs8, passphrase) {
    assertSupport();
    var salt = randomBytes(16), iv = randomBytes(12);
    var key = await passphraseKey(passphrase, salt, PBKDF2_ITERATIONS);
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, pkcs8);
    return { v: 1, alg: "PBKDF2-SHA256+AES-256-GCM", iterations: PBKDF2_ITERATIONS, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  }

  // Devolve a chave privada como CryptoKey NÃO exportável (lança erro se a senha estiver errada)
  async function unwrapPrivateKey(box, passphrase) {
    assertSupport();
    var key = await passphraseKey(passphrase, fromB64(box.salt), box.iterations || PBKDF2_ITERATIONS);
    var pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return subtle.importKey("pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  }

  function importPrivatePkcs8(pkcs8) {
    return subtle.importKey("pkcs8", pkcs8, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  }

  async function publicKeyFingerprint(jwk) {
    var digest = await subtle.digest("SHA-256", enc.encode(jwk.x + "." + jwk.y));
    return Array.from(new Uint8Array(digest).slice(0, 6))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join(":").toUpperCase();
  }

  // ---------- cofre de chaves (IndexedDB) ----------
  // Guarda objetos CryptoKey não exportáveis: o navegador deixa usá-los,
  // mas não permite extrair os bytes da chave.
  function openVault() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("pettemhome-vault", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("keys"); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function vault(mode, fn) {
    var db = await openVault();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("keys", mode);
      var req = fn(tx.objectStore("keys"));
      tx.oncomplete = function () { db.close(); resolve(req && req.result); };
      tx.onerror = function () { db.close(); reject(tx.error); };
    });
  }

  window.PetCrypto = {
    toB64: toB64,
    randomSalt: function () { return toB64(randomBytes(16)); },
    randomId: randomId,
    safeEqual: safeEqual,
    deriveUserKeys: deriveUserKeys,
    emailIndex: emailIndex,
    encryptWithKey: encryptWithKey,
    decryptWithKey: decryptWithKey,
    generateStoreKeyPair: generateStoreKeyPair,
    sealForStore: sealForStore,
    openSealed: openSealed,
    generateVaultKeyPair: generateVaultKeyPair,
    wrapPrivateKey: wrapPrivateKey,
    unwrapPrivateKey: unwrapPrivateKey,
    importPrivatePkcs8: importPrivatePkcs8,
    publicKeyFingerprint: publicKeyFingerprint,
    vaultSet: function (name, key) { return vault("readwrite", function (s) { return s.put(key, name); }); },
    vaultGet: function (name) { return vault("readonly", function (s) { return s.get(name); }); },
    vaultDelete: function (name) { return vault("readwrite", function (s) { return s.delete(name); }); }
  };
})();
