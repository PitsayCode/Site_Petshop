# Pet Tem Home — site, solicitações e painel da loja

Site do pet shop **Pet Tem Home** (Francisco Morato – SP) com catálogo 3D,
mapa das lojas, cadastro de clientes, formulário de solicitação e painel
administrativo exclusivo da loja.

## Recursos

- 👤 Cadastro e login de clientes (com recuperação de senha)
- 📝 Formulário de solicitação: pedido de produtos, encomenda, orçamento ou dúvida
- 📦 Número sequencial da solicitação (#0001, #0002…)
- 🕐 Data e horário registrados pelo servidor, inclusive de cada mudança de status
- 📊 Painel administrativo só para a equipe da loja
- 🔴 Novas solicitações destacadas, com contador e aviso sonoro
- 🔄 Status: Pendente → Em andamento → Concluído
- 🔔 Atualização automática (tempo real + checagem a cada 20 s)
- 👨‍💼 Cadastro dos clientes no painel, com busca
- 📱 Interface adaptada para celular
- 🗺️ Mapa das lojas, loja mais perto e rotas
- 🧊 Produtos em 3D

## Estrutura

```
├── index.html          Página principal (catálogo, vitrine 3D, mapa, sacola)
├── solicitacao.html    Formulário de solicitação
├── login.html          Entrar, criar conta, recuperar senha, minhas solicitações
├── painel.html         Painel da loja (equipe)
├── vercel.json         Endereços sem .html e cabeçalhos de segurança
├── supabase/schema.sql Banco de dados, regras de acesso e tempo real
├── css/styles.css
└── js/
    ├── config.js       WhatsApp, lojas e chaves do Supabase
    ├── api.js          Camada de dados (Supabase ou demonstração)
    ├── crypto.js       Criptografia (Web Crypto)
    ├── solicitacao.js  Formulário
    ├── login.js        Conta do cliente
    ├── painel.js       Painel da loja
    ├── main.js         Página principal
    ├── mapa.js         Mapa das lojas
    ├── produto3d.js    Vitrine 3D e visualização rápida
    ├── data.js         Produtos
    └── 3d/             Motor e modelos 3D
```

## Dois modos de funcionamento

| Modo | Quando | Como funciona |
|---|---|---|
| **Demonstração** | `supabaseUrl` vazio em `js/config.js` | Tudo fica salvo no navegador. Para apresentar: abra `/painel` e o site no **mesmo navegador** |
| **Online** | Chaves do Supabase preenchidas | Clientes de qualquer aparelho enviam solicitações e a loja recebe no painel em tempo real |

---

## Colocar no ar (gratuito): Supabase + Vercel

### 1. Criar o banco no Supabase
1. Crie uma conta em **supabase.com** e clique em **New project** (plano Free).
2. Anote a senha do banco que você definir.
3. Vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.

### 2. Configurar o login
Em **Authentication → URL Configuration**:
- **Site URL:** o endereço da Vercel (ex.: `https://site-petshop.vercel.app`)
- **Redirect URLs:** adicione `https://site-petshop.vercel.app/login`

Em **Authentication → Sign In / Providers → Email**:
- Com **Confirm email** ligado, o cliente confirma o e-mail antes de entrar (recomendado).
- Para uma apresentação rápida, dá para desligar.

### 3. Ligar o site ao banco
Em **Project Settings → API**, copie e cole em `js/config.js`:

```js
supabaseUrl: "https://SEU-PROJETO.supabase.co",
supabaseAnonKey: "a chave anon public",
```

A chave *anon* é pública por natureza; a proteção vem das regras (RLS) do
`schema.sql`. **Nunca** coloque a chave `service_role` no site.

Faça commit e push para o GitHub.

### 4. Publicar na Vercel
1. Em **vercel.com**, clique em **Add New → Project** e importe o repositório `Site_Petshop`.
2. Framework Preset: **Other**. Build Command e Output Directory: deixe em branco.
3. Clique em **Deploy**. Cada push no GitHub atualiza o site sozinho.

### 5. Criar o acesso da loja
1. Acesse `/login` no site publicado e crie a conta da loja (ex.: `loja@pettemhome.com.br`).
   Não precisa preencher endereço de verdade; ou crie em **Authentication → Users → Add user**.
2. No **SQL Editor** do Supabase, rode (trocando o e-mail):

```sql
insert into public.staff (user_id, name)
select id, 'Pet Tem Home' from auth.users where email = 'loja@pettemhome.com.br'
on conflict (user_id) do nothing;
```

3. Acesse `/painel`, entre com essa conta e **crie a senha do cofre**.

> ⚠️ **A senha do cofre não pode ser recuperada.** Ela abre os dados de todos
> os clientes. Guarde num gerenciador de senhas. Se perder, os cadastros e
> solicitações antigos ficam ilegíveis para sempre.

Pronto: clientes se cadastram em `/login`, enviam em `/solicitacao` e a loja
acompanha em `/painel`.

---

## Segurança e privacidade

| Dado | Proteção | Quem consegue ler |
|---|---|---|
| Senha do cliente | Hash (Supabase Auth, bcrypt) | Ninguém |
| Nome, telefone, endereço | Cifrados no navegador e lacrados para a chave da loja | Só o painel com a senha do cofre, e o próprio cliente |
| Detalhes da solicitação | Idem | Só o painel e o próprio cliente |
| E-mail | Necessário para login e recuperação de senha | Supabase Auth |
| Status, número, datas, loja, tipo | Não sensíveis, em texto normal | Cliente (as suas) e equipe |

- **Regras do banco (RLS):** o cliente só vê as próprias solicitações. Só quem está na tabela `staff` abre o painel, lista clientes e muda status. Número, data e status inicial são definidos pelo servidor.
- **O que o dono do banco vê:** quem abre o Supabase vê apenas texto cifrado nos dados pessoais.
- **Limite importante:** a criptografia protege os dados guardados, não um site adulterado. Proteja o acesso ao GitHub, à Vercel e ao Supabase com senha forte e verificação em duas etapas.
- **Trocar a senha pelo "esqueci minha senha":** o cliente confirma os dados de novo, porque a cópia cifrada com a senha antiga não abre mais.

## Mapa das lojas

O mapa usa blocos (tiles) do OpenStreetMap. Esses servidores são mantidos por
voluntários e às vezes recusam o acesso (erro 403), devolvendo um bloco com o
aviso "Access blocked" **no formato de imagem** — por isso o site confere a
resposta de verdade, e não só se a imagem carregou.

Ordem de tentativa, automática:

1. `tile.openstreetmap.org`
2. `tile.openstreetmap.de`
3. CARTO Voyager (`basemaps.cartocdn.com`)

Se os três recusarem, aparece um aviso com link para o Google Maps, e os botões
de rota continuam funcionando. Os créditos do mapa mudam junto com o servidor.

Se o site ficar muito movimentado, vale contratar um serviço próprio de mapas
(MapTiler ou Stadia Maps têm plano gratuito com chave) e trocar a lista
`PROVIDERS` em `js/mapa.js`.

## Personalização

- Produtos e preços: `js/data.js`
- Lojas, coordenadas do mapa e WhatsApp: `js/config.js`
- Ao alterar o CSS, aumente o número em `styles.css?v=5` nos arquivos HTML.
