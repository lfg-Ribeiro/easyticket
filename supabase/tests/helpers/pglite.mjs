// =====================================================================
// Helper de testes SQL: sobe um Postgres em memória (PGlite) que imita o Supabase
// (JWT via request.jwt.claims, papéis anon/authenticated/service_role, privilégios padrão)
// e aplica as migrations do repositório em ordem.
//
// Uso:  npm i --no-save @electric-sql/pglite
//       node supabase/tests/referral.test.mjs
//
// "Drift shim": em produção existem o enum 'admin'/'validator' e a tabela event_organizers,
// que não estão nas migrations do repositório — o helper os recria entre as migrations antigas
// e as de cortesia/indicação, como no banco real.
// =====================================================================
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

export const STUB = `
create schema if not exists auth; create schema if not exists storage; create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz);
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub','')::uuid $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

// Imita os privilégios padrão do Supabase no schema public
export const SUPABASE_DEFAULT_PRIVS = `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

// Deriva conhecida: produção tem esses itens, mas as migrations do repositório não
export const PROD_DRIFT_SHIM = `
alter type public.app_role add value if not exists 'admin';
alter type public.app_role add value if not exists 'validator';
create table if not exists public.event_organizers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
alter table public.event_organizers enable row level security;
grant all on public.event_organizers to anon, authenticated, service_role;
`;

export async function applyMigrations(db, dir, { only } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const failures = [];
  for (const f of files) {
    if (only && !only(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try { await db.exec(sql); } catch (e) { failures.push([f, String(e.message).slice(0, 160)]); }
  }
  return failures;
}

export async function newDb() {
  const db = new PGlite();
  await db.exec(STUB);
  return db;
}

export async function buildDb({ shim = true } = {}) {
  const db = await newDb();
  await db.exec(SUPABASE_DEFAULT_PRIVS);
  // migrations "antigas" (anteriores às de cortesia/indicação)
  const base = await applyMigrations(db, MIGRATIONS_DIR, { only: (f) => f < "20261118" });
  if (base.length) throw new Error("base migrations failed: " + JSON.stringify(base));
  if (shim) await db.exec(PROD_DRIFT_SHIM);
  const recent = await applyMigrations(db, MIGRATIONS_DIR, { only: (f) => f >= "20261118" });
  return { db, recent };
}

/** Executa `fn` como um usuário autenticado (claims do JWT) ou anônimo (claims = null). */
export async function as(db, claims, fn) {
  const role = claims ? "authenticated" : "anon";
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims ? JSON.stringify(claims) : ""]);
  try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims','',false)"); }
}
