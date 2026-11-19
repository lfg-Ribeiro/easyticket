// =====================================================================
// Testes do sistema de cortesias (Roadmap 3.1 + 3.2) rodando a migration de verdade
// num Postgres em memória (PGlite), simulando o Supabase (JWT, papéis, privilégios).
//
// Como rodar (a dependência não é instalada no projeto de propósito):
//   npm i --no-save @electric-sql/pglite
//   node supabase/tests/courtesy.test.mjs
//
// Cobre: trigger automático, RPCs (autorização/validação), RLS de tickets,
// constraints e a garantia de zero distorção financeira (pedidos/estoque/receita).
// "Drift shim": em produção existem o enum 'admin'/'validator' e a tabela
// event_organizers, que não estão nas migrations do repositório — o teste os recria.
// =====================================================================
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");


const STUB = `
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

async function applyMigrations(db, dir, { only } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const failures = [];
  for (const f of files) {
    if (only && !only(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try { await db.exec(sql); } catch (e) { failures.push([f, String(e.message).slice(0, 160)]); }
  }
  return failures;
}

async function newDb() {
  const db = new PGlite();
  await db.exec(STUB);
  return db;
}

// Imita os privilégios padrão do Supabase no schema public
const SUPABASE_DEFAULT_PRIVS = `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

// Deriva conhecida: produção tem esses itens, mas as migrations do repositório não
const PROD_DRIFT_SHIM = `
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

async function buildDb({ shim = true, withCourtesy = true } = {}) {
  const db = await newDb();
  await db.exec(SUPABASE_DEFAULT_PRIVS);
  const base = await applyMigrations(db, MIGRATIONS_DIR, { only: (f) => !f.startsWith("20261118") });
  if (base.length) throw new Error("base migrations failed: " + JSON.stringify(base));
  if (shim) {
    await db.exec(PROD_DRIFT_SHIM);
  }
  let courtesy = [];
  if (withCourtesy) {
    courtesy = await applyMigrations(db, MIGRATIONS_DIR, { only: (f) => f.startsWith("20261118") });
  }
  return { db, courtesy };
}

async function as(db, claims, fn) {
  const role = claims ? "authenticated" : "anon";
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims ? JSON.stringify(claims) : ""]);
  try { return await fn(); } finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims','',false)"); }
}

// ---------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };
const rows = async (db, sql, params) => (await db.query(sql, params)).rows;
const num = async (db, sql, params) => Number((await db.query(sql, params)).rows[0].n);
async function err(fn) { try { await fn(); return null; } catch (e) { return { code: e.code, message: String(e.message) }; } }

const VALID_CPF = "529.982.247-25";      // válido
const VALID_CPF_2 = "111.444.777-35";    // válido
const BAD_CPF = "111.111.111-11";

const { db } = await buildDb({ shim: true });
const q = (sql, p) => db.query(sql, p);

async function mkUser(email, { confirmed = true, name = "", cpf = null } = {}) {
  const r = await q(
    "insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1, $2::jsonb, $3) returning id",
    [email, JSON.stringify({ full_name: name, cpf }), confirmed ? new Date().toISOString() : null]);
  return r.rows[0].id;
}
const addRole = (uid, role) => q("insert into public.user_roles (user_id, role) values ($1, $2::public.app_role) on conflict do nothing", [uid, role]);
const mkEvent = async (creator, title, extra = "") => (await q(
  "insert into public.events (organizer_id, title, event_date, event_time, location, venue) values ($1,$2,'2026-12-01','22:00','Foz','Arena') returning id", [creator, title])).rows[0].id;
const claims = (id, email) => ({ sub: id, email, role: "authenticated" });

console.log("\n== Setup");
const creator = await mkUser("creator@x.com", { name: "Criador Silva" }); await addRole(creator, "organizer");
const prodA = await mkUser("prodA@x.com", { name: "Produtor A" }); await addRole(prodA, "organizer");
const prodB = await mkUser("prodB@x.com", { name: "Produtor B" }); await addRole(prodB, "organizer");
const prodNone = await mkUser("prodnone@x.com", { name: "Sem Vinculo" }); await addRole(prodNone, "organizer");
const adm = await mkUser("adm@x.com", { name: "Admin Role" }); await addRole(adm, "admin");
const buyer = await mkUser("buyer@x.com", { name: "Compradora Silva", cpf: VALID_CPF_2 });
const stranger = await mkUser("stranger@x.com", { name: "Estranho Lima" });

// Evento A criado ANTES dos donos terem conta
const evA = await mkEvent(creator, "Evento A");
await q("insert into public.event_organizers (event_id, user_id) values ($1,$2)", [evA, prodA]);

console.log("\n== 3.1 Trigger automático");
const trig = await rows(db, "select * from public.tickets where event_id=$1 and courtesy_type='admin' order by guest_email", [evA]);
ok("gera 1 cortesia 'admin' para cada dono (2 no total)", trig.length === 2);
ok("e-mails dos donos gravados em guest_email", trig.map(t => t.guest_email).join() === "lribeiro@easyticket.com,zluan720@gmail.com");
ok("sem pedido, sem lote, válida, is_complimentary", trig.every(t => t.order_id === null && t.batch_id === null && t.is_complimentary && t.check_in_status === "valid"));
ok("sem conta ainda => user_id nulo", trig.every(t => t.user_id === null));
ok("QR no formato TICKET-XXXXXXXX-N-XXXXXXXX", trig.every(t => /^TICKET-[0-9A-F]{8}-\d-[0-9A-F]{8}$/.test(t.qr_code)), trig.map(t => t.qr_code).join());

const owner1 = await mkUser("lribeiro@easyticket.com", { name: "Luiz Ribeiro" });
const owner2 = await mkUser("ZLuan720@gmail.com", { name: "Z Luan" });  // maiúsculas no cadastro
const linked = await rows(db, "select guest_email, user_id from public.tickets where event_id=$1 and courtesy_type='admin'", [evA]);
ok("cadastro posterior vincula a cortesia automaticamente (e-mail, case-insensitive)",
  linked.find(t => t.guest_email === "lribeiro@easyticket.com").user_id === owner1 && linked.find(t => t.guest_email === "zluan720@gmail.com").user_id === owner2);

const evB = await mkEvent(creator, "Evento B");
await q("insert into public.event_organizers (event_id, user_id) values ($1,$2)", [evB, prodB]);
const trigB = await rows(db, "select user_id, holder_name from public.tickets where event_id=$1 and courtesy_type='admin' order by guest_email", [evB]);
ok("com donos já cadastrados, user_id resolvido na criação", trigB.length === 2 && trigB[0].user_id === owner1 && trigB[1].user_id === owner2);
ok("holder_name vem do perfil", trigB[0].holder_name === "Luiz Ribeiro");

await q("alter table public.tickets add constraint boom check (false) not valid");
const evBoom = await err(() => mkEvent(creator, "Evento Boom"));
await q("alter table public.tickets drop constraint boom");
ok("falha ao gerar cortesia NUNCA impede a criação do evento", evBoom === null);
ok("(e o evento foi criado, sem cortesias)", await num(db, "select count(*) n from public.events where title='Evento Boom'") === 1);

// pedido pago + lote em A
const batch = (await q("insert into public.ticket_batches (event_id, name, price, total_quantity, available_quantity) values ($1,'Lote 1',50,100,98) returning id", [evA])).rows[0].id;
const order = (await q("insert into public.orders (event_id, buyer_name, buyer_email, quantity, subtotal, service_fee, platform_fee, total_amount, payment_method, payment_status) values ($1,'Compradora','buyer@x.com',2,100,5,5,105,'pix','confirmed') returning id", [evA])).rows[0].id;
await q("insert into public.tickets (order_id, event_id, batch_id, qr_code, holder_name, holder_email, user_id) values ($1,$2,$3,'TICKET-PAID0001-1-AAAAAAAA','Compradora','buyer@x.com',$4), ($1,$2,$3,'TICKET-PAID0001-2-BBBBBBBB','Compradora','buyer@x.com',$4)", [order, evA, batch, buyer]);

const before = {
  orders: await num(db, "select count(*) n from public.orders"),
  avail: await num(db, "select available_quantity n from public.ticket_batches where id=$1", [batch]),
  revenue: await num(db, "select coalesce(sum(subtotal),0) n from public.orders where payment_status in ('confirmed','paid')"),
  sold: await num(db, "select coalesce(sum(quantity),0) n from public.orders where payment_status in ('confirmed','paid')"),
};

console.log("\n== Constraints");
ok("ingresso pago sem order_id é recusado", (await err(() => q("insert into public.tickets (event_id, qr_code, holder_name, holder_email) values ($1,'X1','a','a@a.com')", [evA])))?.code === "23514");
ok("cortesia com order_id é recusada", (await err(() => q("insert into public.tickets (order_id, event_id, qr_code, holder_name, holder_email, is_complimentary, courtesy_type) values ($1,$2,'X2','a','a@a.com',true,'organizer')", [order, evA])))?.code === "23514");
ok("courtesy_type inválido é recusado", (await err(() => q("insert into public.tickets (event_id, qr_code, holder_name, holder_email, is_complimentary, courtesy_type) values ($1,'X3','a','a@a.com',true,'vip')", [evA])))?.code === "23514");

console.log("\n== 3.1 RPC issue_admin_courtesy — autorização");
const call = (c, args) => as(db, c, () => q("select public.issue_admin_courtesy($1,$2,$3,$4,$5) as r", args));
const A = (name = "Convidada Souza", email = "conv@x.com", cpf = VALID_CPF, qty = 1, ev = evA) => [ev, name, email, cpf, qty];
ok("anon: sem permissão de execução", !!(await err(() => as(db, null, () => q("select public.issue_admin_courtesy($1,$2,$3,$4,$5)", A())))));
for (const [label, c] of [["comprador comum", claims(buyer, "buyer@x.com")], ["produtor", claims(prodA, "prodA@x.com")], ["admin (role)", claims(adm, "adm@x.com")], ["criador do evento", claims(creator, "creator@x.com")]]) {
  const e = await err(() => call(c, A()));
  ok(`${label} => 42501`, e?.code === "42501", JSON.stringify(e));
}
const fakeOwner = await mkUser("zluan720@gmail.com", { confirmed: false, name: "Impostor" });
const eFake = await err(() => call(claims(fakeOwner, "zluan720@gmail.com"), A()));
ok("cadastro com e-mail de dono SEM confirmação => 42501", eFake?.code === "42501", JSON.stringify(eFake));
const eSpoof = await err(() => call(claims(buyer, "lribeiro@easyticket.com"), A()));
ok("JWT com e-mail de dono mas sub de outro usuário => 42501", eSpoof?.code === "42501", JSON.stringify(eSpoof));

const r1 = await call(claims(owner1, "LRibeiro@EasyTicket.com"), A("Convidada Souza", "conv@x.com", VALID_CPF, 3));
const res1 = r1.rows[0].r;
ok("dono (e-mail em maiúsculas no JWT) emite 3 cortesias", res1.issued === 3 && res1.qr_codes.length === 3);
const r2 = await call(claims(owner2, "zluan720@gmail.com"), A("Outra Pessoa", "outra@x.com", VALID_CPF_2, 1, evB));
ok("segundo dono também emite", r2.rows[0].r.issued === 1);

console.log("\n== RPC issue_admin_courtesy — validação");
const own = claims(owner1, "lribeiro@easyticket.com");
for (const [label, args, code] of [
  ["quantidade 0", A("Ana Souza", "a@x.com", VALID_CPF, 0), "22023"],
  ["quantidade 21", A("Ana Souza", "a@x.com", VALID_CPF, 21), "22023"],
  ["quantidade nula", A("Ana Souza", "a@x.com", VALID_CPF, null), "22023"],
  ["CPF com dígito verificador errado", A("Ana Souza", "a@x.com", BAD_CPF), "22023"],
  ["CPF curto", A("Ana Souza", "a@x.com", "123"), "22023"],
  ["e-mail inválido", A("Ana Souza", "a@x", VALID_CPF), "22023"],
  ["nome em branco", A("  ", "a@x.com", VALID_CPF), "22023"],
  ["evento inexistente", A("Ana Souza", "a@x.com", VALID_CPF, 1, "00000000-0000-0000-0000-000000000000"), "P0002"],
]) ok(`recusa ${label}`, (await err(() => call(own, args)))?.code === code);
await q("update public.events set deleted_at = now() where title='Evento Boom'");
const evDel = (await q("select id from public.events where title='Evento Boom'")).rows[0].id;
ok("recusa evento excluído (soft-delete)", (await err(() => call(own, A("Ana Souza", "a@x.com", VALID_CPF, 1, evDel))))?.code === "P0002");
ok("aceita 20 (limite) com QR únicos", (await call(own, A("Lote Grande", "grande@x.com", VALID_CPF, 20))).rows[0].r.qr_codes.length === 20);
ok("QR codes são únicos", await num(db, "select count(*)-count(distinct qr_code) n from public.tickets") === 0);

console.log("\n== Resolução do destinatário");
const byCpf = (await call(own, A("Compradora Silva", "diferente@x.com", VALID_CPF_2))).rows[0].r;
ok("casa conta existente pelo CPF (só dígitos), mesmo com e-mail diferente", byCpf.user_linked === true &&
  (await num(db, "select count(*) n from public.tickets where id=$1 and user_id=$2", [byCpf.ticket_ids[0], buyer])) === 1);
const byMail = (await call(own, A("Estranho Lima", "STRANGER@x.com", VALID_CPF))).rows[0].r;
ok("casa conta existente pelo e-mail (case-insensitive)", byMail.user_linked === true &&
  (await num(db, "select count(*) n from public.tickets where id=$1 and user_id=$2", [byMail.ticket_ids[0], stranger])) === 1);
const none = (await call(own, A("Sem Conta", "semconta@x.com", VALID_CPF))).rows[0].r;
ok("sem conta => user_id nulo, guest_email guardado", none.user_linked === false &&
  (await num(db, "select count(*) n from public.tickets where id=$1 and user_id is null and guest_email='semconta@x.com'", [none.ticket_ids[0]])) === 1);
const late = await mkUser("semconta@x.com", { name: "Sem Conta" });
ok("quando se cadastra depois, a cortesia aparece sozinha", (await num(db, "select count(*) n from public.tickets where id=$1 and user_id=$2", [none.ticket_ids[0], late])) === 1);
ok("CPF digitado no cadastro NÃO reivindica cortesias de terceiros", await (async () => {
  const t = (await call(own, A("Terceiro", "terceiro@x.com", "390.533.447-05"))).rows[0].r;
  const thief = await mkUser("ladrao@x.com", { name: "Ladrao", cpf: "39053344705" });
  await q("update public.profiles set cpf='39053344705' where auth_id=$1", [thief]);
  return (await num(db, "select count(*) n from public.tickets where id=$1 and user_id is null", [t.ticket_ids[0]])) === 1;
})());

console.log("\n== 3.2 RPC issue_organizer_courtesy");
const org = (c, args) => as(db, c, () => q("select public.issue_organizer_courtesy($1,$2,$3,$4,$5) as r", args));
ok("produtor vinculado emite para o PRÓPRIO evento", (await org(claims(prodA, "prodA@x.com"), A("Cort Produtor", "cp@x.com", VALID_CPF, 2, evA))).rows[0].r.issued === 2);
ok("produtor NÃO emite para evento de outro (42501)", (await err(() => org(claims(prodA, "prodA@x.com"), A("X Y", "cp@x.com", VALID_CPF, 1, evB))))?.code === "42501");
ok("produtor sem vínculo => 42501", (await err(() => org(claims(prodNone, "prodnone@x.com"), A("X Y", "cp@x.com", VALID_CPF, 1, evA))))?.code === "42501");
ok("comprador comum => 42501", (await err(() => org(claims(buyer, "buyer@x.com"), A("X Y", "cp@x.com", VALID_CPF, 1, evA))))?.code === "42501");
ok("anon => sem permissão", !!(await err(() => as(db, null, () => q("select public.issue_organizer_courtesy($1,$2,$3,$4,$5)", A())))));
ok("criador do evento (organizer_id) emite", (await org(claims(creator, "creator@x.com"), A("Cort Criador", "cc@x.com", VALID_CPF, 1, evA))).rows[0].r.issued === 1);
ok("admin (role) emite", (await org(claims(adm, "adm@x.com"), A("Cort Admin", "ca@x.com", VALID_CPF, 1, evB))).rows[0].r.issued === 1);
ok("tipo gravado é 'organizer'", await num(db, "select count(*) n from public.tickets where guest_email='cp@x.com' and courtesy_type='organizer'") === 2);
ok("validação também vale para produtor (CPF inválido)", (await err(() => org(claims(prodA, "prodA@x.com"), A("X Y", "cp@x.com", BAD_CPF, 1, evA))))?.code === "22023");

console.log("\n== Funções internas não expostas");
for (const fn of ["public.insert_courtesy_tickets($1,'admin','A B','a@a.com','52998224725',1)", "public.generate_ticket_qr(1)", "public.resolve_courtesy_holder('a@a.com','52998224725')"]) {
  ok(`authenticated não executa ${fn.split("(")[0]}`, !!(await err(() => as(db, claims(owner1, "lribeiro@easyticket.com"), () => q(`select ${fn}`, fn.includes("$1") ? [evA] : [])))));
}
ok("list_admin_courtesy_events: dono vê todos (inclui não publicados)", (await as(db, own, () => q("select * from public.list_admin_courtesy_events()"))).rows.length >= 2);
ok("list_admin_courtesy_events: produtor => 42501", (await err(() => as(db, claims(prodA, "prodA@x.com"), () => q("select * from public.list_admin_courtesy_events()"))))?.code === "42501");

console.log("\n== RLS: quem enxerga o quê");
const see = (c, where = "true") => as(db, c, async () => (await q(`select event_id, courtesy_type, is_complimentary, guest_email from public.tickets where ${where}`)).rows);
const pa = await see(claims(prodA, "prodA@x.com"));
ok("produtor A: NUNCA vê cortesia 'admin'", pa.every(t => t.courtesy_type !== "admin"));
ok("produtor A: vê as cortesias 'organizer' do próprio evento", pa.filter(t => t.courtesy_type === "organizer").length >= 2 && pa.filter(t => t.courtesy_type === "organizer").every(t => t.event_id === evA));
ok("produtor A: vê ingressos pagos do próprio evento", pa.filter(t => !t.is_complimentary).length === 2);
ok("produtor A: não vê NADA do evento B", pa.every(t => t.event_id === evA));
const pb = await see(claims(prodB, "prodB@x.com"));
ok("produtor B: só o evento B, sem cortesia admin", pb.length > 0 && pb.every(t => t.event_id === evB && t.courtesy_type !== "admin"));
ok("organizer sem vínculo não vê ingresso algum", (await see(claims(prodNone, "prodnone@x.com"))).length === 0);
ok("admin (role) vê tudo, exceto cortesia 'admin'", await (async () => { const r = await see(claims(adm, "adm@x.com")); return r.length > 0 && r.every(t => t.courtesy_type !== "admin") && r.some(t => t.event_id === evB); })());
const master = await see(claims(owner1, "lribeiro@easyticket.com"));
ok("master (Super Admin) vê também as cortesias 'admin'", master.some(t => t.courtesy_type === "admin"));
const mine = await see(claims(owner2, "zluan720@gmail.com"));
ok("segundo dono vê as próprias cortesias (por user_id)", mine.some(t => t.courtesy_type === "admin" && t.guest_email === "zluan720@gmail.com"));
const buyerSees = await see(claims(buyer, "buyer@x.com"));
ok("comprador vê seus ingressos pagos + cortesia recebida (admin) por user_id", buyerSees.filter(t => !t.is_complimentary).length === 2 && buyerSees.some(t => t.courtesy_type === "admin"));
ok("comprador só vê cortesias endereçadas a ele (casadas pelo CPF dele)", buyerSees.every(t => !t.is_complimentary || ["diferente@x.com", "outra@x.com"].includes(t.guest_email)));
ok("estranho só vê o que é dele", (await see(claims(stranger, "stranger@x.com"))).every(t => t.guest_email?.toLowerCase() === "stranger@x.com"));
// cortesia com user_id nulo visível pelo e-mail do JWT
await q("insert into public.tickets (event_id, qr_code, holder_name, holder_email, is_complimentary, courtesy_type, guest_email, guest_name) values ($1,'TICKET-NOUSER01-1-AAAAAAAA','Fulano','fulano@x.com',true,'organizer','fulano@x.com','Fulano')", [evA]);
const fulanoId = await mkUser("fulano2@x.com", { name: "Outro Fulano" });
ok("cortesia sem user_id é visível pelo e-mail do JWT", (await see(claims(fulanoId, "FULANO@x.com"), "qr_code='TICKET-NOUSER01-1-AAAAAAAA'")).length === 1);
ok("…e invisível para quem tem outro e-mail", (await see(claims(fulanoId, "fulano2@x.com"), "qr_code='TICKET-NOUSER01-1-AAAAAAAA'")).length === 0);
ok("anon não lê nenhum ticket (RLS)", (await as(db, null, () => q("select * from public.tickets"))).rows.length === 0);

console.log("\n== RLS: UPDATE / DELETE");
const adminTicket = (await q("select id from public.tickets where event_id=$1 and courtesy_type='admin' limit 1", [evA])).rows[0].id;
const orgTicket = (await q("select id from public.tickets where event_id=$1 and courtesy_type='organizer' limit 1", [evA])).rows[0].id;
const paidTicket = (await q("select id from public.tickets where order_id=$1 limit 1", [order])).rows[0].id;
const upd = (c, id, set) => as(db, c, () => q(`update public.tickets set ${set} where id=$1 returning id`, [id]));
const C = claims(creator, "creator@x.com");
ok("criador NÃO altera cortesia 'admin' (0 linhas)", (await upd(C, adminTicket, "holder_name='hack'")).rows.length === 0);
ok("criador altera cortesia 'organizer' do evento", (await upd(C, orgTicket, "holder_name='Editado'")).rows.length === 1);
ok("criador não consegue promover ingresso a 'admin'", (await err(() => upd(C, orgTicket, "courtesy_type='admin'"))) !== null);
ok("criador não consegue disfarçar ingresso pago de cortesia (constraint)", (await err(() => upd(C, paidTicket, "is_complimentary=true, courtesy_type='organizer'")))?.code === "23514");

const del = (c, id) => as(db, c, () => q("delete from public.tickets where id=$1 returning id", [id]));
const PA = claims(prodA, "prodA@x.com");
ok("produtor NÃO revoga cortesia 'admin'", (await del(PA, adminTicket)).rows.length === 0);
ok("produtor NÃO revoga ingresso pago", (await del(PA, paidTicket)).rows.length === 0);
const orgB = (await q("select id from public.tickets where event_id=$1 and courtesy_type='organizer' limit 1", [evB])).rows[0].id;
ok("produtor NÃO revoga cortesia de outro evento", (await del(PA, orgB)).rows.length === 0);
ok("estranho NÃO revoga cortesia", (await del(claims(stranger, "stranger@x.com"), orgTicket)).rows.length === 0);
const toRevoke = (await q("select id from public.tickets where event_id=$1 and courtesy_type='organizer' and holder_name<>'Editado' limit 1", [evA])).rows[0].id;
await q("update public.tickets set check_in_status='used' where id=$1", [orgTicket]);
ok("produtor NÃO revoga cortesia já utilizada", (await del(PA, orgTicket)).rows.length === 0);
ok("produtor revoga cortesia 'organizer' não utilizada do próprio evento", (await del(PA, toRevoke)).rows.length === 1);
ok("estoque do lote NÃO é devolvido/alterado ao revogar", await num(db, "select available_quantity n from public.ticket_batches where id=$1", [batch]) === before.avail);

console.log("\n== Zero distorção financeira");
const after = {
  orders: await num(db, "select count(*) n from public.orders"),
  avail: await num(db, "select available_quantity n from public.ticket_batches where id=$1", [batch]),
  revenue: await num(db, "select coalesce(sum(subtotal),0) n from public.orders where payment_status in ('confirmed','paid')"),
  sold: await num(db, "select coalesce(sum(quantity),0) n from public.orders where payment_status in ('confirmed','paid')"),
};
ok("nenhum pedido criado por cortesias", after.orders === before.orders);
ok("estoque dos lotes pagos intacto", after.avail === before.avail);
ok("receita e ingressos vendidos (por pedidos) intactos", after.revenue === before.revenue && after.sold === before.sold);
ok("get_sales_by_day ignora cortesias", await (async () => { const r = await q("select coalesce(sum(tickets_sold),0)::int n, coalesce(sum(revenue),0)::numeric n2 from public.get_sales_by_day(now() - interval '1 day', now() + interval '1 day')"); return Number(r.rows[0].n) === 2 && Number(r.rows[0].n2) === 105; })());
ok("há muitas cortesias no banco (para o teste ser relevante)", await num(db, "select count(*) n from public.tickets where is_complimentary") > 25);

console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
