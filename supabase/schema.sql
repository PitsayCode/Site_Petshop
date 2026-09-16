-- =====================================================================
-- Pet Tem Home — banco de dados (Supabase / PostgreSQL)
--
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (os comandos são idempotentes).
--
-- Proteção dos dados:
--  * Senhas: ficam no Supabase Auth (hash bcrypt). Ninguém vê.
--  * Nome, telefone, endereço e detalhes das solicitações: chegam aqui já
--    CRIPTOGRAFADOS pelo navegador. Quem abre este banco vê só texto
--    embaralhado. Só o painel da loja, com a senha do cofre, consegue ler.
--  * Regras (RLS): cliente só enxerga o que é dele; só a equipe da loja
--    acessa o painel, a lista de clientes e muda o status.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Equipe da loja (quem pode abrir o painel)
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null default 'Equipe Pet Tem Home',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Cofre da loja: chave pública (para lacrar dados) e chave privada
-- cifrada com a "senha do cofre" (só a loja sabe).
-- ---------------------------------------------------------------------
create table if not exists public.store_vault (
  id                    smallint primary key default 1 check (id = 1),
  public_jwk            jsonb not null,
  encrypted_private_key jsonb not null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) default auth.uid()
);

-- Qualquer visitante pode ler SOMENTE a chave pública
create or replace function public.store_public_key()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public_jwk from public.store_vault where id = 1;
$$;

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  user_id              uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  key_salt             text  not null,   -- salt para derivar a chave pessoal (não é segredo)
  profile_for_customer jsonb not null,   -- cifrado com a chave derivada da senha do cliente
  profile_for_store    jsonb not null,   -- lacrado com a chave pública da loja
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_login_at        timestamptz
);

-- ---------------------------------------------------------------------
-- Solicitações
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('pendente', 'em_andamento', 'concluido');
  end if;
end $$;

create table if not exists public.requests (
  id                uuid primary key default gen_random_uuid(),
  number            bigint generated always as identity unique,
  customer_id       uuid not null default auth.uid() references public.customers(user_id) on delete cascade,
  store_id          text not null check (store_id in ('loja1', 'loja2', 'loja3')),
  kind              text not null check (char_length(kind) <= 60),
  delivery          text not null check (delivery in ('entrega', 'retirada')),
  status            public.request_status not null default 'pendente',
  seen_by_store     boolean not null default false,
  data_for_store    jsonb not null,   -- lacrado para a loja
  data_for_customer jsonb not null,   -- cifrado para o próprio cliente
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);

create index if not exists requests_status_created_idx on public.requests (status, created_at desc);
create index if not exists requests_customer_idx on public.requests (customer_id, created_at desc);

-- Datas controladas pelo servidor
create or replace function public.touch_request()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists requests_touch on public.requests;
create trigger requests_touch before update on public.requests
for each row execute function public.touch_request();

create or replace function public.touch_customer()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
for each row execute function public.touch_customer();

-- Na criação, o servidor define número, status e datas (o navegador não escolhe)
create or replace function public.prepare_request()
returns trigger
language plpgsql
as $$
begin
  new.customer_id := auth.uid();
  new.status := 'pendente';
  new.seen_by_store := false;
  new.created_at := now();
  new.updated_at := now();
  new.status_changed_at := now();
  return new;
end $$;

drop trigger if exists requests_prepare on public.requests;
create trigger requests_prepare before insert on public.requests
for each row execute function public.prepare_request();

-- ---------------------------------------------------------------------
-- Segurança: RLS + permissões por coluna
-- ---------------------------------------------------------------------
alter table public.staff       enable row level security;
alter table public.store_vault enable row level security;
alter table public.customers   enable row level security;
alter table public.requests    enable row level security;

revoke all on public.staff, public.store_vault, public.customers, public.requests from anon;
revoke all on public.staff, public.store_vault, public.customers, public.requests from authenticated;

grant select on public.staff to authenticated;
grant select, insert, update on public.store_vault to authenticated;
grant select, insert on public.customers to authenticated;
grant update (key_salt, profile_for_customer, profile_for_store, last_login_at) on public.customers to authenticated;
grant select, insert on public.requests to authenticated;
grant update (status, seen_by_store) on public.requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.store_public_key() to anon, authenticated;
grant execute on function public.is_staff() to authenticated;

-- staff
drop policy if exists "staff: ver o próprio vínculo" on public.staff;
create policy "staff: ver o próprio vínculo" on public.staff
  for select to authenticated using (user_id = auth.uid());

-- store_vault (chave privada cifrada: só a equipe)
drop policy if exists "cofre: equipe lê" on public.store_vault;
create policy "cofre: equipe lê" on public.store_vault
  for select to authenticated using (public.is_staff());
drop policy if exists "cofre: equipe cria" on public.store_vault;
create policy "cofre: equipe cria" on public.store_vault
  for insert to authenticated with check (public.is_staff());
drop policy if exists "cofre: equipe atualiza" on public.store_vault;
create policy "cofre: equipe atualiza" on public.store_vault
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- customers
drop policy if exists "clientes: cria o próprio cadastro" on public.customers;
create policy "clientes: cria o próprio cadastro" on public.customers
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "clientes: vê o próprio ou equipe vê todos" on public.customers;
create policy "clientes: vê o próprio ou equipe vê todos" on public.customers
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "clientes: atualiza o próprio" on public.customers;
create policy "clientes: atualiza o próprio" on public.customers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- requests
drop policy if exists "solicitações: cliente cria as suas" on public.requests;
create policy "solicitações: cliente cria as suas" on public.requests
  for insert to authenticated
  with check (exists (select 1 from public.customers c where c.user_id = auth.uid()));
drop policy if exists "solicitações: cliente vê as suas, equipe vê todas" on public.requests;
create policy "solicitações: cliente vê as suas, equipe vê todas" on public.requests
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
drop policy if exists "solicitações: só a equipe muda status" on public.requests;
create policy "solicitações: só a equipe muda status" on public.requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Tempo real (painel atualiza sozinho). O Realtime respeita o RLS.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;
end $$;

-- =====================================================================
-- ACESSO DA EQUIPE POR CÓDIGO
--
-- O gestor entra com e-mail e senha (conta mestre). Os funcionários entram
-- digitando só um CÓDIGO, definido pelo gestor.
--
-- A chave do cofre fica guardada em DUAS cópias cifradas:
--   encrypted_private_key -> abre com a senha do cofre (gestor)
--   key_for_code          -> abre com o código da equipe (funcionários)
-- Assim o gestor troca o código quando quiser, mesmo sem lembrar do antigo.
-- =====================================================================

alter table public.store_vault add column if not exists key_for_code jsonb;
alter table public.store_vault add column if not exists code_hash    text;
alter table public.store_vault add column if not exists code_set_at  timestamptz;

-- Tentativas de código (freio contra tentativa e erro em massa)
create table if not exists public.code_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ok boolean not null
);
alter table public.code_attempts enable row level security;
revoke all on public.code_attempts from anon, authenticated;

create or replace function public.check_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  fails int;
begin
  select count(*) into fails from public.code_attempts
    where ok = false and at > now() - interval '15 minutes';
  if fails >= 20 then
    raise exception 'Muitas tentativas seguidas. Aguarde alguns minutos.' using errcode = '55000';
  end if;

  select code_hash into h from public.store_vault where id = 1;
  if h is null or p_code is null or crypt(p_code, h) <> h then
    insert into public.code_attempts (ok) values (false);
    return false;
  end if;

  insert into public.code_attempts (ok) values (true);
  delete from public.code_attempts where at < now() - interval '1 day';
  return true;
end $$;

-- O gestor define ou troca o código (e a cópia da chave cifrada com ele)
create or replace function public.set_staff_code(p_code text, p_key_for_code jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas a equipe da loja pode definir o código.' using errcode = '42501';
  end if;
  if p_code is null then
    update public.store_vault set code_hash = null, key_for_code = null, code_set_at = null where id = 1;
    return;
  end if;
  if length(p_code) < 8 then
    raise exception 'O código precisa ter pelo menos 8 caracteres.' using errcode = '22023';
  end if;
  update public.store_vault
     set code_hash = crypt(p_code, gen_salt('bf', 10)),
         key_for_code = p_key_for_code,
         code_set_at = now()
   where id = 1;
end $$;

-- Funções usadas pelo painel quando o acesso é por código
create or replace function public.painel_vault(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.store_vault;
begin
  if not public.check_code(p_code) then return null; end if;
  select * into v from public.store_vault where id = 1;
  return jsonb_build_object('public_jwk', v.public_jwk, 'key_for_code', v.key_for_code);
end $$;

create or replace function public.painel_requests(p_code text)
returns setof public.requests
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_code(p_code) then
    raise exception 'Código incorreto.' using errcode = '28000';
  end if;
  return query select * from public.requests order by created_at desc limit 500;
end $$;

create or replace function public.painel_customers(p_code text)
returns setof public.customers
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_code(p_code) then
    raise exception 'Código incorreto.' using errcode = '28000';
  end if;
  return query select * from public.customers order by created_at desc limit 1000;
end $$;

create or replace function public.painel_set_status(p_code text, p_id uuid, p_status public.request_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_code(p_code) then
    raise exception 'Código incorreto.' using errcode = '28000';
  end if;
  update public.requests set status = p_status, seen_by_store = true where id = p_id;
end $$;

create or replace function public.painel_mark_seen(p_code text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_code(p_code) then
    raise exception 'Código incorreto.' using errcode = '28000';
  end if;
  update public.requests set seen_by_store = true where id = p_id;
end $$;

revoke execute on function public.check_code(text) from anon, authenticated;
grant execute on function public.painel_vault(text) to anon, authenticated;
grant execute on function public.painel_requests(text) to anon, authenticated;
grant execute on function public.painel_customers(text) to anon, authenticated;
grant execute on function public.painel_set_status(text, uuid, public.request_status) to anon, authenticated;
grant execute on function public.painel_mark_seen(text, uuid) to anon, authenticated;
grant execute on function public.set_staff_code(text, jsonb) to authenticated;

-- =====================================================================
-- DEPOIS DE RODAR: dar acesso ao painel para a conta da loja
--
-- 1. Crie a conta da loja normalmente em /login (ou em Authentication →
--    Users → Add user no Supabase).
-- 2. Rode, trocando o e-mail:
--
--    insert into public.staff (user_id, name)
--    select id, 'Pet Tem Home' from auth.users where email = 'loja@exemplo.com'
--    on conflict (user_id) do nothing;
-- =====================================================================
