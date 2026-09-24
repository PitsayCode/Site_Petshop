// Bosque Pet — configuração central do site
//
// Projeto de demonstração: a loja, os contatos e os endereços são fictícios.
// Tudo que muda entre "demonstração" e "produção" fica neste arquivo.

window.PET_CONFIG = {
  // Contatos da loja. Vazio = os botões de WhatsApp abrem o app sem destinatário.
  whatsapp: "",
  instagram: "https://www.instagram.com/",

  // Supabase (banco de dados online). Enquanto estes campos ficarem vazios, o
  // site roda em MODO DEMONSTRAÇÃO: contas, pedidos e painel funcionam com os
  // dados salvos no navegador de quem está visitando, sem back-end nenhum.
  //
  // Para ligar a um banco de verdade, no painel do Supabase (Settings → API Keys
  // ou o botão "Connect"):
  //   supabaseUrl = "Project URL"       → https://SEU-PROJETO.supabase.co
  //   supabaseKey = "Chave publicável"  → começa com sb_publishable_
  //
  // A chave publicável pode ficar aqui: ela respeita as regras de acesso do
  // banco (RLS). A chave secreta (sb_secret_...) nunca entra no site.
  supabaseUrl: "",
  supabaseKey: "",

  // E-mails que podem entrar no painel como gestor. Lista vazia = qualquer
  // conta marcada como equipe entra (no modo demonstração, qualquer e-mail).
  managerEmails: [],

  // Unidades exibidas no mapa. Endereços fictícios; as coordenadas apontam
  // para pontos reais de São Paulo só para o mapa ficar bonito na demonstração.
  stores: [
    {
      id: "loja1",
      name: "Unidade Vila Madalena",
      district: "Vila Madalena",
      address: "Rua das Acácias, 120 – Vila Madalena",
      city: "São Paulo – SP",
      lat: -23.5546,
      lng: -46.6906
    },
    {
      id: "loja2",
      name: "Unidade Santana",
      district: "Santana",
      address: "Av. Braz Leme, 980 – Santana",
      city: "São Paulo – SP",
      lat: -23.5040,
      lng: -46.6285
    },
    {
      id: "loja3",
      name: "Unidade Tatuapé",
      district: "Tatuapé",
      address: "Rua Serra de Bragança, 310 – Tatuapé",
      city: "São Paulo – SP",
      lat: -23.5395,
      lng: -46.5750
    }
  ]
};
