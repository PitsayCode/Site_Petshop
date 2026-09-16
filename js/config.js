// Pet Tem Home — configuração central do site
// Tudo que muda entre "demonstração" e "produção" fica aqui.

window.PET_CONFIG = {
  whatsapp: "5511934208414",
  instagram: "https://www.instagram.com/pettemhome/",

  // Supabase (banco de dados online, gratuito). Passo a passo no README.
  //
  // No painel do Supabase: Settings → API Keys (ou o botão "Connect" no topo).
  //   supabaseUrl = "Project URL"       → https://SEU-PROJETO.supabase.co
  //   supabaseKey = "Chave publicável"  → começa com sb_publishable_
  //                 (nos projetos antigos chamava "anon public")
  //
  // A chave publicável PODE ficar aqui: ela respeita as regras do banco (RLS).
  // A "Chave secreta" (sb_secret_...) NUNCA entra no site: ela ignora as regras.
  //
  // Enquanto ficarem vazios, o site funciona em MODO DEMONSTRAÇÃO: tudo fica
  // salvo só no navegador de quem está usando.
  // E-mail(s) que podem entrar no painel como GESTOR. Qualquer outro e-mail
  // é recusado no login, mesmo com a senha certa. Para trocar de gestor,
  // altere aqui (e, no modo online, marque a conta na tabela staff do banco).
  // Lista vazia ([]) = qualquer conta marcada como staff pode entrar.
  managerEmails: ["victoralexandre608@gmail.com"],

  supabaseUrl: "https://knpcvojrntdehuwbtohd.supabase.co",
  supabaseKey: "sb_publishable__DcxQUvH65EgSjQTXzkrDg_n4u6A_j0",

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
