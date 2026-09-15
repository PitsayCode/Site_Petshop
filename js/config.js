// Pet Tem Home — configuração central do site
// Tudo que muda entre "demonstração" e "produção" fica aqui.

window.PET_CONFIG = {
  whatsapp: "5511934208414",
  instagram: "https://www.instagram.com/pettemhome/",

  // Chave PÚBLICA do painel de comandas (formato JWK).
  // Em produção, cole aqui a chave exportada pelo painel (botão
  // "Copiar chave pública" em painel.html). Com ela preenchida, os pedidos
  // são lacrados para o painel mesmo que ele esteja em outro computador.
  // Enquanto for null, o site usa a chave publicada pelo painel neste
  // mesmo navegador (modo demonstração).
  storePublicKeyJwk: null,

  // Lojas exibidas no mapa. Coordenadas aproximadas (OpenStreetMap) —
  // confirme no Google Maps com o cliente antes de publicar.
  stores: [
    {
      id: "loja1",
      name: "Loja 1",
      district: "Jardim Santo Antônio",
      address: "Rua Olavo Bilac, 743 – Jardim Santo Antônio",
      city: "Francisco Morato – SP",
      lat: -23.2776,
      lng: -46.7521
    },
    {
      id: "loja2",
      name: "Loja 2",
      district: "Jardim Sílvia",
      address: "Estrada Arcílio Federzoni, 31 – Jardim Sílvia",
      city: "Francisco Morato – SP",
      lat: -23.2717,
      lng: -46.7306
    },
    {
      id: "loja3",
      name: "Loja 3",
      district: "Francisco Morato",
      address: "Endereço a confirmar pelo WhatsApp",
      city: "Francisco Morato – SP",
      lat: null,
      lng: null
    }
  ]
};
