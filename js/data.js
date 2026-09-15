// Pet Tem Home — catálogo de produtos
// Preços ilustrativos: ajuste com a loja antes de publicar.
// "model" define como o produto é desenhado em 3D (js/3d/*.js).

window.PET_CATEGORIES = [
  { id: "todos", label: "Tudo", emoji: "🐾", cover: "r5" },
  { id: "racao", label: "Ração & petiscos", emoji: "🦴", cover: "r1" },
  { id: "aquarismo", label: "Aquarismo", emoji: "🐠", cover: "a1" },
  { id: "roupinhas", label: "Roupinhas", emoji: "🧥", cover: "c1" },
  { id: "brinquedos", label: "Brinquedos", emoji: "🎾", cover: "b3" },
  { id: "pesca", label: "Pesca", emoji: "🎣", cover: "p1" },
  { id: "jardinagem", label: "Jardinagem", emoji: "🌱", cover: "j2" }
];

window.PET_FEATURED = ["r1", "a1", "b3", "b1", "c1", "p1"];

window.PET_PRODUCTS = [
  {
    id: "r1", cat: "racao", name: "Ração Cães Adultos 15 kg", price: 189.9, emoji: "🐕", tone: "earth",
    desc: "Sabor carne e cereais, para raças médias e grandes. Grãos crocantes e alimento completo para o dia a dia.",
    specs: ["15 kg", "Raças médias e grandes", "Adultos"],
    model: { kind: "bag", opts: {
      colorTop: "#3E7B4F", colorBottom: "#1D3F29", accent: "#E9B949", title: "RAÇÃO CÃES",
      subtitle: "Adultos · Carne & cereais", weight: "15 kg", figure: "dog", art: "kibble",
      kibbleColor: "#9A5B2E", extras: "kibble", features: ["Carne", "Cereais", "Vitaminas"]
    } }
  },
  {
    id: "r2", cat: "racao", name: "Ração Gatos Castrados 10 kg", price: 164.9, emoji: "🐈", tone: "water",
    desc: "Salmão e arroz, com controle de calorias para gatos castrados e cuidado com o trato urinário.",
    specs: ["10 kg", "Gatos castrados", "Salmão"],
    model: { kind: "bag", opts: {
      w: 1.4, h: 2.0, d: 0.55, seed: 5,
      colorTop: "#2F7F8F", colorBottom: "#173F4A", accent: "#F3CF6A", title: "RAÇÃO GATOS",
      subtitle: "Castrados · Salmão & arroz", weight: "10 kg", figure: "cat", art: "kibble",
      kibbleColor: "#8A5A36", extras: "kibble", features: ["Salmão", "Leve", "Trato urinário"],
      tagline: "PARA GATOS EXIGENTES"
    } }
  },
  {
    id: "r3", cat: "racao", name: "Petisco Bifinho 500 g", price: 29.9, emoji: "🦴", tone: "berry",
    desc: "Bifinhos macios sabor carne, fáceis de partir. Perfeitos como recompensa no treino.",
    specs: ["500 g", "Sabor carne", "Todas as idades"],
    model: { kind: "bag", opts: {
      w: 1.1, h: 1.5, d: 0.36, topStart: 0.5, seed: 9,
      colorTop: "#B4506A", colorBottom: "#6E2A3C", accent: "#F3CF6A", title: "BIFINHO",
      subtitle: "Sabor carne · Macio", weight: "500 g", figure: "puppy", extras: "treats",
      features: ["Macio", "Carne"], tagline: "PETISCO DE RECOMPENSA",
      hs: { front: ["Recompensa na medida", "Parta em pedacinhos para usar no treino."] }
    } }
  },
  {
    id: "r4", cat: "racao", name: "Ração Filhotes 3 kg", price: 64.9, emoji: "🐶", tone: "sun",
    desc: "Grãos pequenos para dentes de leite, com DHA e cálcio para o crescimento.",
    specs: ["3 kg", "Até 12 meses", "Grãos pequenos"],
    model: { kind: "bag", opts: {
      w: 1.2, h: 1.7, d: 0.45, seed: 13,
      colorTop: "#EDB94A", colorBottom: "#B8672F", accent: "#FFFCF4", titleInk: "#8C3B22", title: "FILHOTES",
      subtitle: "Cães até 12 meses", weight: "3 kg", figure: "puppy", art: "kibble",
      kibbleColor: "#A0643A", extras: "kibble", features: ["DHA", "Cálcio", "Grão mini"],
      figureColor: "#8C3B22", tagline: "CRESCIMENTO SAUDÁVEL"
    } }
  },
  {
    id: "r5", cat: "racao", name: "Comedouro Inox 1,5 L", price: 39.9, emoji: "🥣", tone: "leaf",
    desc: "Aço inox polido com anel de borracha antiderrapante. Não pega cheiro e vai à lava-louças.",
    specs: ["1,5 litro", "Aço inox", "Base de borracha"],
    model: { kind: "bowl", opts: {}, variants: [
      { label: "Grafite", swatch: "#2B2F2A", opts: { baseColor: "#2B2F2A" } },
      { label: "Verde", swatch: "#2E5E3E", opts: { baseColor: "#2E5E3E" } },
      { label: "Rosa", swatch: "#B4506A", opts: { baseColor: "#B4506A" } }
    ] }
  },
  {
    id: "a1", cat: "aquarismo", name: "Aquário 40 L completo", price: 329.0, emoji: "🐠", tone: "water",
    desc: "Vidro extra claro com filtro e luminária LED. É só montar a decoração e colocar água.",
    specs: ["40 litros", "Filtro incluso", "Luminária LED"],
    model: { kind: "aquarium", opts: {}, zoom: 0.95 }
  },
  {
    id: "a2", cat: "aquarismo", name: "Ração para Peixes 100 g", price: 19.9, emoji: "🐟", tone: "water",
    desc: "Flocos balanceados para peixes tropicais, com ingredientes que realçam as cores.",
    specs: ["100 g", "Flocos", "Peixes tropicais"],
    model: { kind: "jar", opts: {} }
  },
  {
    id: "a3", cat: "aquarismo", name: "Plantas Naturais (kit 5)", price: 44.9, emoji: "🌿", tone: "leaf", badge: "Kit 5 mudas",
    desc: "Cinco mudas fáceis em copinhos com lã de rocha, para montar um aquário plantado.",
    specs: ["5 mudas", "Pouca luz", "Prontas para plantar"],
    model: { kind: "plantkit", opts: {} }
  },
  {
    id: "c1", cat: "roupinhas", name: "Casaquinho de Moletom", price: 59.9, emoji: "🧥", tone: "earth",
    desc: "Moletom forrado e macio, com punhos de ribana. Do P ao GG para os dias frios.",
    specs: ["P ao GG", "Forrado", "Lavável"],
    model: { kind: "folded", opts: { style: "hoodie", color: "#2E5E3E", color2: "#C8864A" }, variants: [
      { label: "Verde", swatch: "#2E5E3E", opts: { color: "#2E5E3E", color2: "#C8864A" } },
      { label: "Mostarda", swatch: "#D9A43A", opts: { color: "#D9A43A", color2: "#2E5E3E" } },
      { label: "Vinho", swatch: "#8C3A4A", opts: { color: "#8C3A4A", color2: "#DCCFB8" } }
    ] }
  },
  {
    id: "c2", cat: "roupinhas", name: "Capa de Chuva Pet", price: 49.9, emoji: "☔", tone: "sun",
    desc: "Impermeável, com capuz e faixa refletiva para passeios seguros em dias de chuva.",
    specs: ["P ao GG", "Impermeável", "Refletiva"],
    model: { kind: "folded", opts: { style: "raincoat", color: "#F2C230", color2: "#2F7F8F" }, variants: [
      { label: "Amarela", swatch: "#F2C230", opts: { color: "#F2C230", color2: "#2F7F8F" } },
      { label: "Azul", swatch: "#2F7F8F", opts: { color: "#2F7F8F", color2: "#F2C230" } },
      { label: "Vermelha", swatch: "#C8453A", opts: { color: "#C8453A", color2: "#34383C" } }
    ] }
  },
  {
    id: "b1", cat: "brinquedos", name: "Bolinha de Tênis Pet (3 un.)", price: 17.9, emoji: "🎾", tone: "leaf", badge: "Kit 3 un.",
    desc: "Feltro macio com costura resistente. Quica muito e é fácil de pegar com a boca.",
    specs: ["3 bolinhas", "Feltro macio", "Ø 6,5 cm"],
    model: { kind: "ball", opts: { color: "#CFE042" }, variants: [
      { label: "Limão", swatch: "#CFE042", opts: { color: "#CFE042" } },
      { label: "Laranja", swatch: "#F08A3A", opts: { color: "#F08A3A" } },
      { label: "Rosa", swatch: "#E86A9A", opts: { color: "#E86A9A" } }
    ] }
  },
  {
    id: "b2", cat: "brinquedos", name: "Osso de Nylon", price: 24.9, emoji: "🦴", tone: "sun",
    desc: "Nylon atóxico e durável, com relevos que ajudam na limpeza dos dentes.",
    specs: ["Nylon atóxico", "Mastigação intensa", "Tamanho M"],
    model: { kind: "bone", opts: {}, variants: [
      { label: "Natural", swatch: "#DCC49A", opts: { color: "#DCC49A" } },
      { label: "Azul", swatch: "#8DB8D8", opts: { color: "#8DB8D8" } },
      { label: "Coral", swatch: "#E08A78", opts: { color: "#E08A78" } }
    ] }
  },
  {
    id: "b3", cat: "brinquedos", name: "Arranhador para Gatos", price: 89.9, emoji: "🐱", tone: "earth",
    desc: "Poste de sisal natural, plataforma acolchoada no alto e pompom para brincar.",
    specs: ["Sisal natural", "80 cm", "Base pesada"],
    model: { kind: "scratcher", opts: {}, variants: [
      { label: "Bege", swatch: "#B89C78", opts: { color: "#B89C78", pomColor: "#E88AA2" } },
      { label: "Cinza", swatch: "#A2A6A8", opts: { color: "#A2A6A8", pomColor: "#E9B949" } },
      { label: "Sálvia", swatch: "#98AE8C", opts: { color: "#98AE8C", pomColor: "#F4EFE3" } }
    ] }
  },
  {
    id: "p1", cat: "pesca", name: "Vara + Molinete Iniciante", price: 149.9, emoji: "🎣", tone: "water",
    desc: "Kit pronto para a pescaria: vara de 1,65 m com cabo de cortiça e molinete já com linha.",
    specs: ["Vara 1,65 m", "Molinete com linha", "Rios e pesqueiros"],
    model: { kind: "rod", opts: {}, zoom: 0.8, thumbZoom: 0.72, variants: [
      { label: "Verde", swatch: "#2E8A5E", opts: { accent: "#2E8A5E" } },
      { label: "Azul", swatch: "#2F6FA8", opts: { accent: "#2F6FA8" } },
      { label: "Vermelho", swatch: "#B8453A", opts: { accent: "#B8453A" } }
    ] }
  },
  {
    id: "p2", cat: "pesca", name: "Kit Iscas Artificiais", price: 39.9, emoji: "🪝", tone: "water", badge: "Kit 5 iscas",
    desc: "Cinco iscas de meia-água com garatéias de aço e acabamento holográfico.",
    specs: ["5 iscas", "Meia-água", "Garatéias de aço"],
    model: { kind: "lures", opts: {}, zoom: 1, thumbZoom: 0.88 }
  },
  {
    id: "j1", cat: "jardinagem", name: "Terra Adubada 20 kg", price: 22.9, emoji: "🪴", tone: "earth",
    desc: "Substrato rico em matéria orgânica para vasos, hortas e canteiros.",
    specs: ["20 kg", "Orgânica", "Pronta para uso"],
    model: { kind: "bag", opts: {
      w: 1.5, h: 2.1, d: 0.6, finish: "woven", seed: 17,
      colorTop: "#6E9448", colorBottom: "#3E5A2C", accent: "#E9B949", title: "TERRA ADUBADA",
      subtitle: "Vasos, hortas e canteiros", weight: "20 kg", figure: "sprout", extras: "soil",
      windowBottom: "#D9C79A", hill: "#6B4A2E", figureColor: "#3E7B4F", features: ["Orgânica", "Pronta p/ uso"],
      tagline: "JARDIM COM VIDA",
      hs: { front: ["Pronta para plantar", "Terra vegetal com composto orgânico."], seal: ["Costura resistente", "Saco de ráfia que aguenta o transporte."] }
    } }
  },
  {
    id: "j2", cat: "jardinagem", name: "Kit Ferramentas de Jardim", price: 54.9, emoji: "🌻", tone: "leaf", badge: "Kit 3 peças",
    desc: "Pá, garfo e rastelo em aço, com cabos de madeira envernizada.",
    specs: ["3 peças", "Aço", "Cabo de madeira"],
    model: { kind: "tools", opts: {}, variants: [
      { label: "Madeira clara", swatch: "#B07A45", opts: { wood: "#B07A45" } },
      { label: "Madeira escura", swatch: "#6B4A2E", opts: { wood: "#6B4A2E" } }
    ] }
  },
  {
    id: "j3", cat: "jardinagem", name: "Sementes de Grama de Gato", price: 12.9, emoji: "🌾", tone: "leaf",
    desc: "Grama que ajuda na digestão dos felinos. Germina em poucos dias num vaso ensolarado.",
    specs: ["50 g", "Germina em 5 dias", "Para gatos"],
    model: { kind: "bag", opts: {
      w: 0.9, h: 1.3, d: 0.12, topStart: 0.85, wrinkle: 0.3, finish: "paper", seed: 21,
      colorTop: "#8DBF5A", colorBottom: "#3E7040", accent: "#F3CF6A", title: "GRAMA DE GATO",
      subtitle: "Sementes para plantar", weight: "50 g", figure: "cat", extras: "seeds",
      features: ["Digestão", "Fácil"], tagline: "PLANTE E CULTIVE",
      hs: { seal: ["Envelope de papel", "Guarde em local seco e fresco."], front: ["Instruções no verso", "Passo a passo para plantar e regar."] }
    } }
  }
];
