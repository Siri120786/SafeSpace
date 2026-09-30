import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

const db = new PGlite();
const ok = (n: string, c: boolean) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) process.exitCode = 1; };

// Stub the bits of Supabase that live outside our migration.
await db.exec(`
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public, auth to authenticated;
`);

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
await db.exec(readFileSync(dir + "0001_init_schema.sql", "utf8"));
await db.exec(readFileSync(dir + "0002_pin_attempts.sql", "utf8"));
await db.exec(readFileSync(dir + "0003_profiles_and_roles.sql", "utf8"));
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
ok("migrations 0001 + 0002 + 0003 apply cleanly", true);

// Sign up a caregiver and a standalone user -> trigger creates profiles + caregivers (only for caregiver).
const a = (await db.query<{id:string}>(`insert into auth.users (raw_user_meta_data) values ('{"role":"caregiver","display_name":"Caregiver A"}') returning id`)).rows[0].id;
const b = (await db.query<{id:string}>(`insert into auth.users (raw_user_meta_data) values ('{"role":"caregiver","display_name":"Caregiver B"}') returning id`)).rows[0].id;
const u = (await db.query<{id:string}>(`insert into auth.users (raw_user_meta_data) values ('{"role":"user","display_name":"User U"}') returning id`)).rows[0].id;

const profs = await db.query<{id:string, role:string, display_name:string}>(`select id, role, display_name from profiles`);
ok("sign-up trigger creates profiles for caregivers and standalone users", profs.rows.length === 3);

const userProf = profs.rows.find(p => p.id === u);
ok("user profile role is 'user'", userProf?.role === "user");

const cg = await db.query<{id:string, family_code:string}>(`select id, family_code from caregivers`);
ok("sign-up trigger creates caregiver rows only for caregivers", cg.rows.length === 2 && cg.rows.every(r => r.id !== u));
ok("family codes are 6 chars and unique", cg.rows.every(r => r.family_code.length === 6) && cg.rows[0].family_code !== cg.rows[1].family_code);

// Data (inserted as superuser, bypassing RLS, as the service role would).
const kid = (age: number, tier: string, cid: string) => db.query<{id:string}>(
  `insert into children (caregiver_id, name, age, pin_hash, privacy_tier) values ($1,'k',$2,'h',$3) returning id`, [cid, age, tier]).then(r => r.rows[0].id);
const young = await kid(6, "full", a);       // caregiver A, full visibility
const mid   = await kid(10, "partial", a);   // caregiver A, partial tier
const other = await kid(6, "full", b);       // caregiver B's child
await db.exec(`insert into child_modules values ('${young}','autism'), ('${mid}','anxiety')`);

const je = (child: string, priv: boolean, text: string) => db.query(
  `insert into journal_entries (child_id, module_key, content, is_private_note) values ($1,'anxiety',$2,$3)`, [child, text, priv]);
await je(mid, false, "shared entry"); await je(mid, true, "PRIVATE note");
await je(young, true, "young flagged private"); await je(other, false, "other family entry");

await db.exec(`insert into emergency_events (child_id, triggered_by) values ('${mid}','journal_flag'), ('${other}','check_in')`);

// Act as caregiver A under RLS.
const asUser = async <T,>(userId: string, sql: string) => {
  await db.exec(`set role authenticated; set app.uid = '${userId}';`);
  try { return (await db.query<T>(sql)).rows; } finally { await db.exec(`reset role;`); }
};

const kids = await asUser(a, `select name from children`);
ok("caregiver sees only their own 2 children", kids.length === 2);

const entries = await asUser<{content:string}>(a, `select content from journal_entries`);
const texts = entries.map(e => e.content);
ok("partial-tier PRIVATE note is hidden from caregiver", !texts.includes("PRIVATE note"));
ok("partial-tier shared entry is visible", texts.includes("shared entry"));
ok("full-tier child's entry visible even if flagged private (privacy only applies to 'partial')", texts.includes("young flagged private"));
ok("other family's journal entries are invisible", !texts.includes("other family entry"));

const ev = await asUser<{child_id:string}>(a, `select child_id from emergency_events`);
ok("emergency events visible regardless of privacy tier (hard override)", ev.length === 1 && ev[0].child_id === mid);

const pa = await asUser(a, `select * from pin_attempts`).catch(() => "denied");
ok("pin_attempts unreadable by caregivers (RLS, no policy)", Array.isArray(pa) && pa.length === 0);

// RLS Profile isolation tests: user A can read profile A, but not profile B or U.
const myProf = await asUser<{display_name:string}>(a, `select display_name from profiles`);
ok("user reads their own profile under RLS", myProf.length === 1 && myProf[0].display_name === "Caregiver A");

const otherProfs = await asUser<{display_name:string}>(a, `select display_name from profiles where id = '${b}'`);
ok("user cannot read another user's profile under RLS", otherProfs.length === 0);

// Caregiver A must not be able to write into caregiver B's family.
await db.exec(`set role authenticated; set app.uid = '${a}';`);
let blocked = false;
try { await db.query(`insert into children (caregiver_id, name, age, pin_hash) values ('${b}','x',6,'h')`); }
catch { blocked = true; } finally { await db.exec(`reset role;`); }
ok("caregiver cannot create a child under another caregiver", blocked);
