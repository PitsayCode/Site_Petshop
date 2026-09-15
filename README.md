# Pet Tem Home — site + contas + painel de comandas

Site do pet shop **Pet Tem Home** (3 lojas em Francisco Morato – SP) com tema
natureza, catálogo interativo, vitrine 3D, mapa das lojas, login de clientes
e um painel de comandas para a loja receber os pedidos.

## Estrutura

```
Pet Tem Home/
├── index.html        Página principal (menu, catálogo, vitrine 3D, mapa, sacola)
├── login.html        Entrar / criar conta / minha conta e pedidos
├── painel.html       HUD de comandas da loja
├── css/styles.css    Tema natureza (cores, tipografia, componentes)
└── js/
    ├── config.js     WhatsApp, lojas (coordenadas do mapa) e chave pública do painel
    ├── data.js       Categorias e produtos (preços ilustrativos)
    ├── crypto.js     Criptografia (Web Crypto API)
    ├── api.js        Camada de dados (hoje simulada no navegador)
    ├── main.js       Menu interativo, catálogo, sacola, checkout e mapa
    ├── produto3d.js  Vitrine 3D, fotos dos produtos e visualização rápida
    ├── login.js      Página de conta
    ├── painel.js     Painel de comandas
    └── 3d/
        ├── core.js           Motor 3D: iluminação de estúdio, materiais, sombras, fotos
        ├── models-food.js    Embalagens, comedouro, pote, bolinha e osso
        ├── models-scene.js   Aquário, plantas, arranhador e roupinhas
        └── models-outdoor.js Vara com molinete, iscas e ferramentas
```

## Produtos em 3D

- Todos os produtos são modelados por código (Three.js), com iluminação de
  estúdio, reflexos, sombras suaves e materiais realistas (plástico com
  verniz, feltro, inox, vidro, madeira, sisal).
- As fotos dos cards são "tiradas" do próprio modelo 3D no navegador, então
  mudar a cor ou o rótulo em `js/data.js` já atualiza a foto.
- Clique na foto de um produto para abrir a visualização rápida: gire, dê
  zoom, troque a cor e toque nos pontos brancos para ver os destaques.
- Para usar um modelo real (.glb) ou foto de estúdio no lugar do modelo
  gerado, é só trocar o `model` do produto em `js/data.js`.
- Ao publicar uma nova versão do CSS, aumente o número em `styles.css?v=3`
  nos arquivos HTML para os navegadores não usarem a versão antiga.

## Como rodar

Login e criptografia precisam de `http://localhost` ou `https://` (não
funcionam abrindo o arquivo com dois cliques). Na pasta do projeto:

```bash
python -m http.server 5500
```

Depois abra `http://localhost:5500`. Para a demonstração completa:

1. Abra `http://localhost:5500/painel.html` em uma aba. Isso gera a chave da loja.
2. Em outra aba, abra o site, coloque produtos na sacola e finalize.
3. Crie a conta. O pedido aparece na hora no painel, com o nome, os itens e o endereço.

É preciso internet para as fontes, o mapa (OpenStreetMap/Leaflet) e o 3D (Three.js).

## Segurança dos dados

| Dado | Como é protegido | Quem consegue ler |
|---|---|---|
| Senha | Hash PBKDF2-SHA256, 600 mil iterações, salt aleatório. Irreversível | Ninguém |
| Cadastro (nome, e-mail, telefone, endereço) | AES-256-GCM com chave derivada da senha da cliente | Só a própria cliente, logada |
| Comanda (dados de entrega) | ECDH P-256 + HKDF + AES-256-GCM com a chave pública do painel | Só o computador do painel |
| E-mail para login | Guardado só como índice derivado (PBKDF2), nunca em texto | Ninguém |

- A chave privada do painel é criada como **não exportável** e fica no
  IndexedDB daquele computador. Nem por script ela pode ser copiada.
- O botão "Ver dados cifrados" no painel mostra como os pedidos ficam
  guardados no banco: só texto embaralhado.
- Esqueceu a senha = conta perdida. É o preço de ninguém mais ter a chave.

### Limites que precisam ficar claros

- **A loja precisa ver o endereço para entregar.** Por isso a comanda é
  aberta no painel. O que fica fechado para todo mundo, inclusive para
  quem administra o site e o banco, são as senhas e os cadastros.
- Quem controla o código do site poderia alterá-lo para capturar dados
  **antes** de cifrar. Criptografia protege dados guardados e em trânsito,
  não um site adulterado. Mantenha o acesso à hospedagem protegido.
- Hoje os "bancos" ficam no `localStorage` do navegador (modo
  demonstração). Por isso site e painel precisam estar no mesmo navegador.

## Indo para produção (integração do painel)

1. Criar uma API (ex.: Node, PHP ou Supabase/Firebase) com HTTPS e trocar
   as funções de `js/api.js` por chamadas `fetch()`. O servidor só recebe e
   guarda blocos já cifrados.
2. No servidor, aplicar mais uma camada de hash na prova de senha (Argon2id)
   e limitar tentativas de login por IP.
3. Abrir `painel.html` no computador da loja, clicar em **Copiar chave
   pública** e colar em `storePublicKeyJwk` no `js/config.js`.
4. Proteger o acesso ao painel com login de funcionário.
5. Enviar atualizações em tempo real (WebSocket, SSE ou Supabase Realtime)
   no lugar do aviso entre abas.

## Revisar com o cliente

- Coordenadas das lojas em `js/config.js` (estão aproximadas) e o endereço da **Loja 3**.
- Produtos e preços em `js/data.js`.
- Fotos reais e modelos 3D reais (`.glb`) dos produtos, se houver.
- Textos de privacidade/LGPD com um profissional.
