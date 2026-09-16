// Pet Tem Home — funções de senha usadas pelo MODO DEMONSTRAÇÃO
//
// No modo online quem cuida das senhas é o Supabase Auth (hash bcrypt no
// servidor). Aqui ficam só as funções equivalentes para a demonstração, que
// roda inteira no navegador:
//
//  * passwordHash : PBKDF2-SHA256 com 600 mil iterações e salt aleatório.
//                   É irreversível: guardamos o hash, nunca a senha.
//  * emailIndex   : índice derivado do e-mail, para achar a conta na
//                   demonstração sem guardar o e-mail em texto no índice.

(function () {
  "use strict";

  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder();

  var PBKDF2_ITERATIONS = 600000;
  var EMAIL_INDEX_ITERATIONS = 100000;
  var EMAIL_INDEX_SALT = "pettemhome:email-index:v1";

  function assertSupport() {
    if (!subtle) {
      throw new Error("Este navegador não suporta criptografia segura. Abra o site por https:// ou http://localhost.");
    }
  }

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
  function randomBytes(n) { return window.crypto.getRandomValues(new Uint8Array(n)); }
  function randomSalt() { return toB64(randomBytes(16)); }
  function randomId(prefix) {
    return (prefix || "") + toB64(randomBytes(12)).replace(/[+/=]/g, "").slice(0, 16);
  }
  // comparação que não entrega a resposta pelo tempo gasto
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  async function passwordHash(password, saltB64) {
    assertSupport();
    var base = await subtle.importKey("raw", enc.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
    var bits = await subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
      base, 256
    );
    return toB64(bits);
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

  window.PetCrypto = {
    randomSalt: randomSalt,
    randomId: randomId,
    safeEqual: safeEqual,
    passwordHash: passwordHash,
    emailIndex: emailIndex
  };
})();
