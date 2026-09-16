-- =====================================================================
-- Pet Tem Home — banco de dados (Supabase / PostgreSQL)
--
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (os comandos são idempotentes).
--
-- Quem acessa o quê:
--   * Cliente  : entra com e-mail e senha; vê e edita só o cadastro dele e
--                as solicitações dele.
--   * Gestor   : conta de e-mail marcada na tabela staff; vê tudo no painel,
--                muda status e define o CÓDIGO da equipe.
--   * Equipe   : entra no painel digitando só o código. As consultas passam
--                por funções que conferem o código a cada chamada.
--
-- Proteção: senhas ficam no Supabase Auth (hash bcrypt, ninguém vê).
-- Os dados de contato e entrega ficam legíveis para a loja (é o que o painel
-- precisa para atender) e para quem administra este banco.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Equipe da loja (contas que podem abrir o painel como gestor)
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
-- Código de acesso da equipe (definido pelo gestor, guardado só como hash)
-- ---------------------------------------------------------------------
create table if not exists public.store_access (
  id          smallint primary key default 1 check (id = 1),
  code_hash   text,
  code_set_at timestamptz,
  updated_by  uuid references auth.users(id)
);
insert into public.store_access (id) values (1) on conflict (id) do nothing;

create table if not exists public.code_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ok boolean not null
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  user_id       uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  name          text not null,
  email         text not null,
  phone         text not null,
  address       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
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
  payment           text not null check (char_length(payment) <= 30),
  contact           text check (char_length(contact) <= 40),
  status            public.request_status not null default 'pendente',
  seen_by_store     boolean not null default false,
  items             jsonb not null default '[]'::jsonb,
  message           text check (char_length(message) <= 1000),
  total             numeric(10,2) not null default 0,
  -- cópia dos dados de contato/entrega no momento do pedido
  snapshot          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now()
);

create index if not exists requests_status_created_idx on public.requests (status, created_at desc);
create index if not exists requests_customer_idx on public.requests (customer_id, created_at desc);

-- ---------------------------------------------------------------------
-- Datas e número controlados pelo servidor
-- ---------------------------------------------------------------------
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
-- Código da equipe: conferência com freio contra tentativa e erro
-- ---------------------------------------------------------------------
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

  select code_hash into h from public.store_access where id = 1;
  if h is null or p_code is null or crypt(p_code, h) <> h then
    insert into public.code_attempts (ok) values (false);
    return false;
  end if;

  insert into public.code_attempts (ok) values (true);
  delete from public.code_attempts where at < now() - interval '1 day';
  return true;
end $$;

-- O gestor define, troca ou desliga o código
create or replace function public.set_staff_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas o gestor pode definir o código da equipe.' using errcode = '42501';
  end if;
  if p_code is null then
    update public.store_access set code_hash = null, code_set_at = null, updated_by = auth.uid() where id = 1;
    return;
  end if;
  if length(p_code) < 6 then
    raise exception 'O código precisa ter pelo menos 6 caracteres.' using errcode = '22023';
  end if;
  update public.store_access
     set code_hash = crypt(p_code, gen_salt('bf', 10)),
         code_set_at = now(),
         updated_by = auth.uid()
   where id = 1;
end $$;

-- Situação do código (o gestor vê se está ativo e desde quando)
create or replace function public.staff_code_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.store_access;
begin
  if not public.is_staff() then
    raise exception 'Apenas o gestor pode ver isso.' using errcode = '42501';
  end if;
  select * into r from public.store_access where id = 1;
  return jsonb_build_object('enabled', r.code_hash is not null, 'set_at', r.code_set_at);
end $$;

-- ---------------------------------------------------------------------
-- Painel acessado por código (sem login): tudo passa por estas funções
-- ---------------------------------------------------------------------
create or replace function public.painel_entrar(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.check_code(p_code);
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

-- ---------------------------------------------------------------------
-- Segurança: RLS + permissões por coluna
-- ---------------------------------------------------------------------
alter table public.staff         enable row level security;
alter table public.store_access  enable row level security;
alter table public.code_attempts enable row level security;
alter table public.customers     enable row level security;
alter table public.requests      enable row level security;

revoke all on public.staff, public.store_access, public.code_attempts, public.customers, public.requests from anon;
revoke all on public.staff, public.store_access, public.code_attempts, public.customers, public.requests from authenticated;

grant select on public.staff to authenticated;
grant select, insert on public.customers to authenticated;
grant update (name, email, phone, address, last_login_at) on public.customers to authenticated;
grant select, insert on public.requests to authenticated;
grant update (status, seen_by_store) on public.requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.check_code(text) from anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.set_staff_code(text) to authenticated;
grant execute on function public.staff_code_status() to authenticated;
grant execute on function public.painel_entrar(text) to anon, authenticated;
grant execute on function public.painel_requests(text) to anon, authenticated;
grant execute on function public.painel_customers(text) to anon, authenticated;
grant execute on function public.painel_set_status(text, uuid, public.request_status) to anon, authenticated;
grant execute on function public.painel_mark_seen(text, uuid) to anon, authenticated;

-- staff
drop policy if exists "staff: ver o próprio vínculo" on public.staff;
create policy "staff: ver o próprio vínculo" on public.staff
  for select to authenticated using (user_id = auth.uid());

-- customers
drop policy if exists "clientes: cria o próprio cadastro" on public.customers;
create policy "clientes: cria o próprio cadastro" on public.customers
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "clientes: vê o próprio, gestor vê todos" on public.customers;
create policy "clientes: vê o próprio, gestor vê todos" on public.customers
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "clientes: atualiza o próprio" on public.customers;
create policy "clientes: atualiza o próprio" on public.customers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- requests
drop policy if exists "solicitações: cliente cria as suas" on public.requests;
create policy "solicitações: cliente cria as suas" on public.requests
  for insert to authenticated
  with check (exists (select 1 from public.customers c where c.user_id = auth.uid()));
drop policy if exists "solicitações: cliente vê as suas, gestor vê todas" on public.requests;
create policy "solicitações: cliente vê as suas, gestor vê todas" on public.requests
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
drop policy if exists "solicitações: só o gestor muda status" on public.requests;
create policy "solicitações: só o gestor muda status" on public.requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Tempo real (o painel do gestor atualiza sozinho)
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
-- DEPOIS DE RODAR: liberar o painel para a conta do gestor
--
-- 1. Crie a conta do gestor em /login (ou em Authentication → Users → Add user).
-- 2. Rode, trocando o e-mail:
--
--    insert into public.staff (user_id, name)
--    select id, 'Pet Tem Home' from auth.users where email = 'gestor@exemplo.com'
--    on conflict (user_id) do nothing;
--
-- 3. Entre em /painel com esse e-mail e defina o código da equipe em Ajustes.
--
-- Para tirar o acesso de alguém:
--    delete from public.staff where user_id = (select id from auth.users where email = 'fulano@exemplo.com');
-- =====================================================================
