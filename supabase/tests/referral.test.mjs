// Testes SQL do rastreamento de indicações (Roadmap 3.3) — ver helpers/pglite.mjs para como rodar.
import { buildDb, as } from "./helpers/pglite.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };
const num = async (db, sql, params) => Number((await db.query(sql, params)).rows[0].n);
async function err(fn) { try { await fn(); return null; } catch (e) { return { code: e.code, message: String(e.message) }; } }

const { db, recent } = await buildDb({ shim: true });
ok("migrations 20261118 + 20261119 aplicam sem erro", recent.length === 0, JSON.stringify(recent));
const q = (sql, p) => db.query(sql, p);

async function mkUser(email, name = "") {
  return (await q("insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values ($1,$2::jsonb,now()) returning id", [email, JSON.stringify({ full_name: name })])).rows[0].id;
}
const addRole = (uid, role) => q("insert into public.user_roles (user_id, role) values ($1,$2::public.app_role) on conflict do nothing", [uid, role]);
const mkEvent = async (creator, title) => (await q("insert into public.events (organizer_id, title, event_date, event_time, location, venue) values ($1,$2,'2026-12-01','22:00','Foz','Arena') returning id", [creator, title])).rows[0].id;
const claims = (id, email) => ({ sub: id, email, role: "authenticated" });
const mkOrder = async (ev, { status = "confirmed", ref = null, qty = 1, subtotal = 50, email = "buyer@x.com", ageMinutes = 0 } = {}) => (await q(
  `insert into public.orders (event_id, buyer_name, buyer_email, quantity, subtotal, service_fee, platform_fee, total_amount, payment_method, payment_status, referred_by, created_at)
   values ($1,'Comprador',$2,$3,$4,$5,$5,$6,'pix',$7,$8, now() - ($9 || ' minutes')::interval) returning id`,
  [ev, email, qty, subtotal, Math.max(subtotal * 0.05, 2.5), subtotal + Math.max(subtotal * 0.05, 2.5), status, ref, String(ageMinutes)])).rows[0].id;
const refOf = async (id) => (await q("select referred_by from public.orders where id=$1", [id])).rows[0].referred_by;

console.log("\n== Setup");
const creator = await mkUser("creator@x.com", "Criador"); await addRole(creator, "organizer");
const prodLinked = await mkUser("linked@x.com", "Produtor Vinculado"); await addRole(prodLinked, "organizer");
const prodOther = await mkUser("other@x.com", "Produtor Outro"); await addRole(prodOther, "organizer");
const adm = await mkUser("adm@x.com", "Admin"); await addRole(adm, "admin");
const buyer = await mkUser("buyer@x.com", "Compradora");
const stranger = await mkUser("stranger@x.com", "Estranho");
const master = await mkUser("lribeiro@easyticket.com", "Master");
const evA = await mkEvent(creator, "Evento A");
const evB = await mkEvent(creator, "Evento B");
await q("insert into public.event_organizers (event_id, user_id) values ($1,$2)", [evA, prodLinked]);
await q("insert into public.event_organizers (event_id, user_id) values ($1,$2)", [evB, prodOther]);

console.log("\n== Coluna e constraint");
ok("orders.referred_by existe, é opcional e vem nula nos pedidos antigos", (await mkOrder(evA).then(refOf)) === null);
ok("formato inválido é recusado pelo banco (maiúscula/espaço)", (await err(() => mkOrder(evA, { ref: "Atletica X" })))?.code === "23514");
ok("mais de 64 caracteres é recusado", (await err(() => mkOrder(evA, { ref: "a".repeat(65) })))?.code === "23514");
ok("índice (event_id, referred_by) existe", await num(db, "select count(*) n from pg_indexes where indexname='idx_orders_event_referred_by'") === 1);

console.log("\n== attach_order_referral");
const attach = (c, id, ref) => as(db, c, async () => (await q("select public.attach_order_referral($1,$2) as r", [id, ref])).rows[0].r);
const anon = null;
let o = await mkOrder(evA, { status: "pending" });
ok("convidado (anon) grava a indicação num pedido recém-criado", (await attach(anon, o, "atletica_engenharia")) === true && (await refOf(o)) === "atletica_engenharia");
ok("first-touch: segunda chamada NÃO sobrescreve", (await attach(anon, o, "outro_codigo")) === false && (await refOf(o)) === "atletica_engenharia");

o = await mkOrder(evA, { status: "pending" });
await attach(anon, o, "  Atlética Eng!! Civil  ");
ok("sanitiza: lower/trim, espaço vira _, remove caracteres inválidos", (await refOf(o)) === "atltica_eng_civil", await refOf(o));
o = await mkOrder(evA, { status: "pending" });
await attach(anon, o, "x".repeat(100));
ok("limita a 64 caracteres", (await refOf(o)).length === 64);
o = await mkOrder(evA, { status: "pending" });
ok("código vazio/inválido não grava nada", (await attach(anon, o, "   ")) === false && (await attach(anon, o, "@@@")) === false && (await refOf(o)) === null);
ok("pedido inexistente => false", (await attach(anon, "00000000-0000-0000-0000-000000000000", "abc")) === false);
ok("order_id nulo => false", (await attach(anon, null, "abc")) === false);

o = await mkOrder(evA, { status: "confirmed" });
ok("pedido já confirmado não aceita indicação (nem de anon, nem do dono)", (await attach(anon, o, "abc")) === false && (await attach(claims(buyer, "buyer@x.com"), o, "abc")) === false && (await refOf(o)) === null);
o = await mkOrder(evA, { status: "cancelled" });
ok("pedido cancelado não aceita indicação", (await attach(anon, o, "abc")) === false);

o = await mkOrder(evA, { status: "pending", ageMinutes: 45 });
ok("pedido antigo (>30 min) por anon => false", (await attach(anon, o, "abc")) === false);
ok("pedido antigo por OUTRO usuário logado => false", (await attach(claims(stranger, "stranger@x.com"), o, "abc")) === false);
ok("pedido antigo pelo dono (e-mail do JWT, case-insensitive) => true", (await attach(claims(buyer, "BUYER@x.com"), o, "abc")) === true && (await refOf(o)) === "abc");

console.log("\n== Quem pode alterar orders.referred_by diretamente");
o = await mkOrder(evA, { status: "pending" });
const direct = await as(db, claims(creator, "creator@x.com"), () => q("update public.orders set referred_by='fraude' where id=$1 returning id", [o]));
ok("produtor não consegue UPDATE direto em orders", direct.rows.length === 0 && (await refOf(o)) === null);

console.log("\n== event_affiliates: RLS");
const ins = (c, ev, name, code, pct = 0) => as(db, c, () => q("insert into public.event_affiliates (event_id, name, ref_code, commission_percent) values ($1,$2,$3,$4) returning id", [ev, name, code, pct]));
const A = claims(creator, "creator@x.com"), L = claims(prodLinked, "linked@x.com"), O = claims(prodOther, "other@x.com");
const affA = (await ins(A, evA, "Atlética Engenharia", "atletica_engenharia", 10)).rows[0].id;
ok("criador cadastra comissionado no próprio evento", !!affA);
ok("produtor vinculado (event_organizers) cadastra", (await ins(L, evA, "Promoter João", "promoter_joao", 5)).rows.length === 1);
ok("produtor de OUTRO evento não cadastra (RLS)", (await err(() => ins(O, evA, "Intruso", "intruso")))?.code === "42501");
ok("comprador comum não cadastra", (await err(() => ins(claims(buyer, "buyer@x.com"), evA, "X", "x")))?.code === "42501");
ok("anon não cadastra", !!(await err(() => ins(null, evA, "X", "x"))));
ok("admin (role) cadastra em qualquer evento", (await ins(claims(adm, "adm@x.com"), evB, "Atlética B", "atletica_b", 0)).rows.length === 1);
ok("master cadastra", (await ins(claims(master, "lribeiro@easyticket.com"), evB, "Master Promo", "master_promo")).rows.length === 1);
ok("(event_id, ref_code) é único", (await err(() => ins(A, evA, "Duplicada", "atletica_engenharia")))?.code === "23505");
ok("mesmo código em OUTRO evento é permitido", (await ins(claims(adm, "adm@x.com"), evB, "Atlética Engenharia", "atletica_engenharia")).rows.length === 1);
ok("comissão acima de 100 é recusada", (await err(() => ins(A, evA, "Alta", "alta", 100.01)))?.code === "23514");
ok("comissão negativa é recusada", (await err(() => ins(A, evA, "Neg", "neg", -1)))?.code === "23514");
ok("ref_code fora do padrão é recusado", (await err(() => ins(A, evA, "Ruim", "Com Espaço")))?.code === "23514");

const sel = (c) => as(db, c, async () => (await q("select ref_code, commission_percent from public.event_affiliates order by ref_code")).rows);
ok("criador (dono dos eventos A e B) enxerga os 5 comissionados cadastrados", (await sel(A)).length === 5);
ok("vinculado ao evento A só vê os do evento A", (await sel(L)).every((r) => ["atletica_engenharia", "promoter_joao"].includes(r.ref_code)) && (await sel(L)).length === 2);
ok("produtor de outro evento não vê os do evento A", (await sel(O)).every((r) => !["promoter_joao"].includes(r.ref_code)));
ok("comprador e anon não enxergam nenhum comissionado (comissão é privada)", (await sel(claims(buyer, "buyer@x.com"))).length === 0 && (await sel(null)).length === 0);

const upd = (c, id, set) => as(db, c, () => q(`update public.event_affiliates set ${set} where id=$1 returning id`, [id]));
ok("vinculado atualiza a comissão do evento dele", (await upd(L, affA, "commission_percent=12.5")).rows.length === 1);
ok("outro produtor NÃO atualiza (0 linhas)", (await upd(O, affA, "commission_percent=99")).rows.length === 0);
ok("não dá para mover um comissionado para evento alheio (WITH CHECK)", (await err(() => upd(L, affA, `event_id='${evB}'`)))?.code === "42501");
const del = (c, id) => as(db, c, () => q("delete from public.event_affiliates where id=$1 returning id", [id]));
ok("outro produtor NÃO exclui", (await del(O, affA)).rows.length === 0);
const tmp = (await ins(A, evA, "Temporário", "temporario")).rows[0].id;
ok("criador exclui", (await del(A, tmp)).rows.length === 1);

console.log("\n== get_affiliate_name (público, sem expor comissão)");
const nameOf = (c, ev, code) => as(db, c, async () => (await q("select public.get_affiliate_name($1,$2) as n", [ev, code])).rows[0].n);
ok("anon recebe o nome do comissionado", (await nameOf(null, evA, "atletica_engenharia")) === "Atlética Engenharia");
ok("código é normalizado (maiúsculas/espaços nas pontas)", (await nameOf(null, evA, "  ATLETICA_ENGENHARIA ")) === "Atlética Engenharia");
ok("código inexistente ou de outro evento => null", (await nameOf(null, evA, "nao_existe")) === null && (await nameOf(null, evA, "atletica_b")) === null);

console.log("\n== Reconciliação e cortesias");
const evR = await mkEvent(creator, "Evento Relatório");
await q("insert into public.event_organizers (event_id, user_id) values ($1,$2)", [evR, prodLinked]);
await mkOrder(evR, { status: "confirmed", ref: "atletica_engenharia", qty: 2, subtotal: 100 });
await mkOrder(evR, { status: "paid", ref: "atletica_engenharia", qty: 1, subtotal: 50 });
await mkOrder(evR, { status: "confirmed", ref: null, qty: 3, subtotal: 150 });
await mkOrder(evR, { status: "confirmed", ref: "promoter_x", qty: 4, subtotal: 200 });
await mkOrder(evR, { status: "pending", ref: "atletica_engenharia", qty: 9, subtotal: 900 });
await mkOrder(evR, { status: "cancelled", ref: "promoter_x", qty: 9, subtotal: 900 });
await mkOrder(evR, { status: "refunded", ref: null, qty: 9, subtotal: 900 });

const totals = async () => (await q("select coalesce(sum(quantity),0)::int qty, coalesce(sum(subtotal),0)::numeric rev, count(*)::int n from public.orders where event_id=$1 and payment_status in ('confirmed','paid')", [evR])).rows[0];
const groups = async () => (await q("select referred_by, count(*)::int n, sum(quantity)::int qty, sum(subtotal)::numeric rev from public.orders where event_id=$1 and payment_status in ('confirmed','paid') group by referred_by order by 1 nulls last", [evR])).rows;
const t0 = await totals();
const g0 = await groups();
ok("grupos por referred_by (+ venda direta) fecham 100% com as vendas confirmadas", g0.reduce((s, r) => s + r.qty, 0) === t0.qty && g0.reduce((s, r) => s + Number(r.rev), 0) === Number(t0.rev) && g0.reduce((s, r) => s + r.n, 0) === t0.n, JSON.stringify(g0));
ok("pendentes, cancelados e reembolsados ficam de fora (10 ingressos / R$ 500)", t0.qty === 10 && Number(t0.rev) === 500);

// cortesias não mexem em nada
const own = claims(master, "lribeiro@easyticket.com");
await as(db, own, () => q("select public.issue_admin_courtesy($1,'Fulano de Tal','fulano@x.com','52998224725',5)", [evR]));
await as(db, L, () => q("select public.issue_organizer_courtesy($1,'Beltrana de Tal','beltrana@x.com','52998224725',3)", [evR]));
ok("há cortesias emitidas no evento (trigger + RPCs)", await num(db, "select count(*) n from public.tickets where event_id=$1 and is_complimentary", [evR]) >= 10);
const t1 = await totals(); const g1 = await groups();
ok("cortesias não alteram pedidos, ingressos vendidos nem faturamento", JSON.stringify(t1) === JSON.stringify(t0) && JSON.stringify(g1) === JSON.stringify(g0));
ok("nenhuma cortesia tem pedido (logo, nunca entra em referred_by)", await num(db, "select count(*) n from public.tickets where is_complimentary and order_id is not null") === 0);

console.log("\n== Cascata");
await q("delete from public.events where id=$1", [evB]);
ok("excluir o evento remove seus comissionados", await num(db, "select count(*) n from public.event_affiliates where event_id=$1", [evB]) === 0);

console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
