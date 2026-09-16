# Pet Tem Home — site, solicitações e painel da loja

Site do pet shop **Pet Tem Home** (Francisco Morato – SP) com catálogo 3D,
mapa das lojas, cadastro de clientes, formulário de solicitação e painel da
loja. Pagamento é presencial (na entrega ou na retirada).

## Recursos

- 👤 Cadastro e login de clientes, com recuperação de senha por e-mail
- 📝 Formulário de solicitação: pedido de produtos, encomenda, orçamento ou dúvida
- 📦 Número sequencial da solicitação (#0001, #0002…)
- 🕐 Data e horário registrados pelo servidor, inclusive de cada mudança de status
- 📊 Painel da loja: gestor entra com e-mail e senha; funcionários com um código
- 🔴 Novas solicitações destacadas, com contador e aviso sonoro
- 🔄 Status: Pendente → Em andamento → Concluído
- 🔔 Atualização automática (tempo real + checagem a cada 20 s)
- 👨‍💼 Lista de clientes no painel, com busca
- 📱 Interface adaptada para celular
- 🗺️ Mapa das lojas, loja mais perto e rotas
- 🧊 Produtos em 3D

## Estrutura

```
├── index.html          Página principal (catálogo, vitrine 3D, mapa, sacola)
├── solicitacao.html    Formulário de solicitação
├── login.html          Entrar, criar conta, recuperar senha, minhas solicitações
├── painel.html         Painel da loja
├── vercel.json         Endereços sem .html e cabeçalhos de segurança
├── supabase/schema.sql Banco de dados, regras de acesso e tempo real
├── css/styles.css
└── js/
    ├── config.js       WhatsApp, lojas e chaves do Supabase
    ├── api.js          Camada de dados (Supabase ou demonstração)
    ├── crypto.js       Hash de senha usado no modo demonstração
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
| **Demonstração** | `supabaseUrl` vazio em `js/config.js` | Tudo salvo no navegador. Para apresentar: abra `/painel` e o site no **mesmo navegador**. Qualquer e-mail e senha entram como gestor |
| **Online** | Chaves do Supabase preenchidas | Clientes de qualquer aparelho enviam solicitações e a loja recebe no painel |

---

## Colocar no ar (gratuito): Supabase + Vercel

### 1. Criar o banco no Supabase
1. Crie uma conta em **supabase.com** e clique em **New project** (plano Free).
2. Anote a senha do banco que você definir.
3. Vá em **SQL Editor → New query**, cole todo o `supabase/schema.sql` e clique em **Run**.

### 2. Configurar o login
Em **Authentication → URL Configuration**:
- **Site URL:** o endereço da Vercel (ex.: `https://site-petshop.vercel.app`)
- **Redirect URLs:** adicione `https://site-petshop.vercel.app/login`

Em **Authentication → Sign In / Providers → Email**:
- Com **Confirm email** ligado, o cliente confirma o e-mail antes de entrar (recomendado).
- Para uma apresentação rápida, dá para desligar.

### 3. Ligar o site ao banco

Abra o arquivo **`js/config.js`** e preencha estas duas linhas (elas ficam logo
no começo, vazias por padrão):

```js
supabaseUrl: "https://SEU-PROJETO.supabase.co",
supabaseKey: "sb_publishable_...",
```

Onde achar cada valor, no painel do Supabase:

| O que copiar | Onde está | Como reconhecer |
|---|---|---|
| **Project URL** | Botão **Connect** (topo) ou **Settings → API Keys** | `https://algumacoisa.supabase.co` |
| **Chave publicável** | **Settings → API Keys** → seção "Chave publicável" | Começa com `sb_publishable_` |

> Nos projetos antigos, a chave publicável se chamava **anon public**. É a mesma
> coisa: o site funciona com qualquer uma das duas.

⚠️ A **Chave secreta** (`sb_secret_...`, antes `service_role`) **nunca** entra no
site: ela ignora as regras de segurança do banco. Ela só é usada por você, em
comandos manuais, como os do manual do administrador mais abaixo.

A chave publicável pode ficar no código e no GitHub sem problema: é para isso
que ela existe. Quem protege os dados são as regras (RLS) do `schema.sql` —
por isso o passo 1 precisa ter sido feito antes.

Depois de preencher, salve, faça commit e push. A Vercel publica sozinha.

### 4. Publicar na Vercel
1. Em **vercel.com**, clique em **Add New → Project** e importe o repositório.
2. Framework Preset: **Other**. Build Command e Output Directory: em branco.
3. **Deploy**. Cada push no GitHub atualiza o site sozinho.

### 5. Liberar o painel para o gestor
1. Crie a conta do gestor em `/login` com o e-mail dele (o "e-mail mestre"),
   ou em **Authentication → Users → Add user**.
2. No **SQL Editor**, rode trocando o e-mail:

```sql
insert into public.staff (user_id, name)
select id, 'Pet Tem Home' from auth.users where email = 'gestor@gmail.com'
on conflict (user_id) do nothing;
```

3. Entre em `/painel` → aba **Sou o gestor** → **⚙️ Ajustes** → defina o
   **código da equipe**. É esse código que os funcionários vão usar.

---

## Quem entra no painel

| Quem | Como entra | Pode |
|---|---|---|
| **Gestor** | Aba "Sou o gestor": e-mail e senha | Tudo: ver e mudar solicitações, ver clientes, definir o código e trocar a própria senha |
| **Funcionário** | Aba "Sou da equipe": só o código | Ver e mudar o status das solicitações e ver a lista de clientes. Não entra nos ajustes |

O código é uma senha compartilhada: **troque sempre que alguém sair da equipe**.
Ao salvar um código novo, o antigo para de valer na hora.

## Esqueci a senha — o que fazer

| Situação | Solução |
|---|---|
| Cliente esqueceu a senha | `/login` → "Esqueci minha senha" → link por e-mail |
| Funcionário esqueceu o código | O gestor entra em ⚙️ Ajustes e gera outro código |
| Gestor esqueceu a senha | Tela do painel → aba "Sou o gestor" → **Esqueci minha senha** → link por e-mail |
| Gestor perdeu o acesso ao e-mail | Aí é com quem administra o site: veja o manual abaixo |

---

## Onde mexer no código (reset de senhas e código)

Mapa rápido: cada linha diz **o que você quer fazer**, **onde isso acontece** e
**onde está no código**, com o comando para achar o trecho na hora.

| O que fazer | Onde a pessoa faz | Arquivo e trecho no código |
|---|---|---|
| Cliente pede link de nova senha | `/login` → "Esqueci minha senha" | Botão em `login.html` (`id="forgotBtn"`) → tela `#forgotView` em `js/login.js` → `requestPasswordReset()` em `js/api.js` |
| Cliente grava a nova senha (volta do link do e-mail) | `/login` abre sozinho a tela | `#recoveryView` em `js/login.js` → `updatePassword()` em `js/api.js` |
| Gestor pede link de nova senha | `/painel` → aba "Sou o gestor" → "Esqueci minha senha" | Botão em `painel.html` (`id="forgotStaff"`) → tratador em `js/painel.js` → `requestPasswordReset()` em `js/api.js` |
| Gestor troca a própria senha já logado | `/painel` → ⚙️ Ajustes → "Senha de login do gestor" | Formulário `#loginPassForm` em `painel.html` e `js/painel.js` → `updatePassword()` em `js/api.js` |
| Gestor cria ou troca o código da equipe | `/painel` → ⚙️ Ajustes → "Código da equipe" | Formulário `#codeSetForm` em `painel.html` e `js/painel.js` → `setStaffCode()` em `js/api.js` → função `set_staff_code` em `supabase/schema.sql` |
| Gestor desliga o acesso por código | `/painel` → ⚙️ Ajustes → "Desativar acesso por código" | Botão `#disableCode` em `js/painel.js` → `setStaffCode(null)` |
| Funcionário entra com o código | `/painel` → aba "Sou da equipe" | `#codeForm` em `painel.html` → `codeEnter()` em `js/api.js` → função `check_code` em `supabase/schema.sql` |

Para achar qualquer um desses trechos, rode na pasta do projeto:

```bash
grep -rn "requestPasswordReset\|updatePassword\|setStaffCode\|codeEnter" js/
```

### Onde ficam as regras (se precisar mudar)

| Regra | Onde |
|---|---|
| Senha precisa ter 8+ caracteres, com letras e números | `validatePassword()` em `js/api.js` |
| Código precisa ter 6+ caracteres | `setStaffCode()` em `js/api.js` **e** `set_staff_code` em `supabase/schema.sql` (mude nos dois) |
| Limite de tentativas do código (20 erros a cada 15 min) | `check_code` em `supabase/schema.sql` |
| Para onde o link do e-mail volta | `requestPasswordReset()` em `js/api.js` (`redirectTo`) e **Authentication → URL Configuration** no Supabase |
| Quem é gestor | Tabela `staff` (veja o manual do administrador abaixo) |

### Modo demonstração (sem Supabase)
Não existe envio de e-mail: o "esqueci minha senha" avisa que só funciona no
modo online. Para começar do zero na demonstração, use o botão **Limpar
demonstração** no painel, que chama `clearDemoData()` em `js/api.js`.

## Problemas comuns

**"Código incorreto" mesmo com o código certo, ou erro 42883 no console**
As funções do banco usam a extensão `pgcrypto`, que no Supabase fica no schema
`extensions`. Se você rodou uma versão antiga do `schema.sql`, rode a atual de
novo (ela já corrige isso). Para conferir pelo SQL Editor:

```sql
select proname, prosecdef, proconfig
from pg_proc where proname in ('check_code', 'set_staff_code');
-- proconfig deve mostrar search_path=public, extensions
```

**"Sem conexão com o sistema da loja"**
URL ou chave errada em `js/config.js`, projeto do Supabase pausado (plano
gratuito pausa após um tempo sem uso) ou internet fora.

**"Este e-mail não tem acesso ao painel"**
O e-mail não está na lista `managerEmails` do `js/config.js`.

**O gestor entra, mas o painel diz que a conta não tem acesso**
Falta marcar a conta na tabela `staff` (veja o passo 5 de "Colocar no ar").

## Manual do administrador (Supabase)

Tudo aqui é feito no painel do Supabase, sem depender de ninguém.

### Trocar a senha de um usuário (gestor ou cliente)
1. **Authentication → Users**.
2. Busque o e-mail, clique nos três pontinhos (⋮) da linha.
3. Use a opção de **recuperação de senha** (envia o link por e-mail) ou a de
   **redefinir senha**, se o seu projeto mostrar esse botão.

Se preferir definir a senha na hora, use a API de administração. Pegue a chave
`service_role` em **Project Settings → API** (ela é secreta, nunca vai para o
site) e o ID do usuário na tela **Users**:

```bash
curl -X PUT "https://SEU-PROJETO.supabase.co/auth/v1/admin/users/ID-DO-USUARIO" \
  -H "apikey: SUA_SERVICE_ROLE" \
  -H "Authorization: Bearer SUA_SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"password":"NovaSenhaForte123"}'
```

### Trocar o e-mail do gestor (quando ele perdeu o acesso ao e-mail antigo)
Mesma tela **Authentication → Users**: abra o usuário e edite o e-mail. Ou pela
API, trocando o corpo do comando acima por:

```json
{"email":"novoemail@gmail.com","email_confirm":true}
```

Depois, confira se a conta continua como gestor:

```sql
select u.email, (s.user_id is not null) as e_gestor
from auth.users u left join public.staff s on s.user_id = u.id;
```

### Dar ou tirar acesso de gestor

```sql
-- dar acesso
insert into public.staff (user_id, name)
select id, 'Nome da pessoa' from auth.users where email = 'pessoa@exemplo.com'
on conflict (user_id) do nothing;

-- tirar acesso
delete from public.staff
where user_id = (select id from auth.users where email = 'pessoa@exemplo.com');
```

### Resetar o código da equipe pelo banco

```sql
-- desativar o código (só o gestor entra até ele criar outro)
update public.store_access set code_hash = null, code_set_at = null where id = 1;

-- ou já definir um código novo
update public.store_access
   set code_hash = crypt('novocodigo2026', gen_salt('bf', 10)), code_set_at = now()
 where id = 1;
```

### Ver ou corrigir dados
- **Table Editor → requests**: todas as solicitações, com status e datas.
- **Table Editor → customers**: cadastro dos clientes.
- **Authentication → Users**: contas, incluindo apagar quem pediu remoção (LGPD).
  Apagar a conta apaga também o cadastro e as solicitações daquele cliente.

> O plano gratuito do Supabase pausa o projeto depois de um tempo sem uso.
> Se o site parar de salvar, entre no painel do Supabase e reative o projeto.

---

## Se você já rodou uma versão anterior do banco

As primeiras versões do `schema.sql` guardavam os dados criptografados e tinham
outras colunas. Se você chegou a rodar uma delas no Supabase, apague o que
ficou antes de rodar a versão atual (isso apaga as solicitações e cadastros de
teste, mas não as contas em Authentication):

```sql
drop table if exists public.requests cascade;
drop table if exists public.customers cascade;
drop table if exists public.store_vault cascade;
drop table if exists public.store_vault_archive cascade;
drop function if exists public.store_public_key() cascade;
drop function if exists public.reset_vault(jsonb, jsonb) cascade;
```

Depois rode o `supabase/schema.sql` atual normalmente.

## Decisão sobre proteção dos dados

Hoje o sistema usa **controle de acesso**: ninguém entra no painel sem o login
do gestor ou o código da equipe, e as regras do banco impedem um cliente de ver
dados de outro. Em troca, quem administra o projeto no Supabase consegue ler os
dados de contato e entrega.

A alternativa seria **criptografia ponta a ponta**, em que nem o Supabase nem o
desenvolvedor conseguem ler. Ela não foi adotada agora por um motivo prático:
para o gestor recuperar o acesso usando só o e-mail, o sistema precisa
conseguir devolver a chave — e o que o sistema devolve, o administrador também
alcança. Com criptografia, o gestor continuaria autônomo, mas precisaria
guardar um **código de recuperação**; perdendo senha, código da equipe e código
de recuperação ao mesmo tempo, o histórico antigo ficaria ilegível.

Ficou combinado: publicar assim e avaliar a criptografia numa segunda etapa,
se o cliente pedir mais rigor. Enquanto isso, o mínimo recomendado é:

- verificação em duas etapas nas contas do Supabase, da Vercel e do GitHub;
- guardar só o necessário do cliente (é o que o formulário pede hoje);
- apagar a conta quando o cliente pedir (Authentication → Users).

## Segurança e privacidade

| Dado | Proteção | Quem consegue ver |
|---|---|---|
| Senhas | Hash bcrypt no Supabase Auth | Ninguém, nem o administrador |
| Código da equipe | Hash bcrypt no banco, com limite de 20 erros a cada 15 min | Ninguém: só dá para conferir se está certo |
| Nome, telefone, endereço | Regras do banco (RLS) + HTTPS | O cliente dono, a equipe da loja e quem administra o Supabase |
| Solicitações | Idem | Idem |

- **Cliente só vê o que é dele.** As regras do banco bloqueiam um cliente de
  ver o cadastro ou as solicitações de outro, mesmo mexendo no navegador.
- **O painel é da loja.** Sem estar na tabela `staff` ou sem o código, o banco
  não devolve nada — a proteção não depende só da tela.
- **Transparência:** os dados de contato e entrega ficam legíveis para a loja e
  para quem administra o banco. É o necessário para atender e entregar.
- **LGPD:** avise o cliente para que os dados são usados (já está no site) e
  apague a conta quando ele pedir.
- Proteja o acesso ao GitHub, à Vercel e ao Supabase com senha forte e
  verificação em duas etapas.

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
de rota continuam funcionando.

Se o site ficar muito movimentado, vale contratar um serviço próprio de mapas
(MapTiler ou Stadia Maps têm plano gratuito com chave) e trocar a lista
`PROVIDERS` em `js/mapa.js`.

## Personalização

- Produtos e preços: `js/data.js`
- Lojas, coordenadas do mapa e WhatsApp: `js/config.js`
- Ao alterar CSS ou JS, aumente o número de versão (`?v=12`) nos arquivos HTML:
  é o que evita o navegador usar a versão antiga guardada em cache.
