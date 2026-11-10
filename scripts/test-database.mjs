/** Executes the real migration on embedded PostgreSQL, with a minimal Supabase
 * Auth shim. No network, hosted database, or real identities are used. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
const A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const S = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const rates = {
  role: "regular",
  hourlyRate: 3500,
  hourlyAdjustment: 0,
  creditedMinutes: 0,
  studentRate: 1100,
  sigmaRate: 1100,
  privateSharedRate: 900,
  privateSoloRate: null,
};
const draft = {
  id: S,
  workDate: "2026-10-01",
  startTime: "09:00",
  endTime: "17:00",
  endNextDay: false,
  timeDisambiguation: "reject",
  startAt: "2026-10-01T06:00:00Z",
  endAt: "2026-10-01T14:00:00Z",
  breakMinutes: 30,
  counts: { student: 10, sigma: 2, privateShared: 1, privateSolo: 0 },
  bonuses: [
    { amount: 2000, description: "bonus" },
    { amount: -500, description: "correction" },
  ],
  notes: "Synthetic test fixture",
};
async function asUser(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function save(value, version = 0, override = null) {
  const result = await db.query(
    "select public.save_shift($1::jsonb,$2,$3::jsonb) as result",
    [
      JSON.stringify(value),
      version,
      override === null ? null : JSON.stringify(override),
    ],
  );
  return result.rows[0].result;
}
async function setRates(date, value) {
  return db.query("select public.set_compensation($1::date,$2::jsonb)", [
    date,
    JSON.stringify(value),
  ]);
}
async function rejects(fn, message) {
  await assert.rejects(fn, (error) => error.message.includes(message));
}

try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await test("real migration applies successfully", async () =>
    db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611090001_packtrack.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ));
  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,$3::jsonb),($2,$4::jsonb)",
    [
      A,
      B,
      JSON.stringify({ packer_role: "regular", hourly_rate: 3500 }),
      JSON.stringify({ packer_role: "checker" }),
    ],
  );
  await asUser(A);
  await test("profile and default history bootstrap, private data hidden", async () => {
    assert.deepEqual((await db.query("select id from public.profiles")).rows, [
      { id: A },
    ]);
    const rows = (
      await db.query("select rates from public.compensation_history")
    ).rows;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].rates, rates);
  });
  let saved;
  await test("transactional shift stores snapshot and signed bonuses", async () => {
    saved = await save(draft);
    assert.deepEqual(saved.shift.rates_snapshot, rates);
    assert.equal(saved.shift.version, 1);
    assert.equal(saved.bonuses.length, 2);
    assert.equal(saved.bonuses[1].amount, -500);
  });
  await test("identical network retry is idempotent", async () => {
    const again = await save(draft);
    assert.equal(again.shift.version, 1);
    assert.deepEqual(again.bonuses, saved.bonuses);
  });
  await test("overlap rejected but adjacent shift allowed", async () => {
    await rejects(() => save({ ...draft, id: T }), "PACKTRACK_OVERLAP");
    await save({
      ...draft,
      id: T,
      startTime: "17:00",
      endTime: "18:00",
      startAt: "2026-10-01T14:00:00Z",
      endAt: "2026-10-01T15:00:00Z",
      bonuses: [],
    });
  });
  const checker = {
    ...rates,
    role: "checker",
    hourlyRate: 5000,
    studentRate: 1500,
    creditedMinutes: 30,
  };
  await test("effective role change preserves existing and backdated snapshots", async () => {
    await setRates("2026-11-01", checker);
    const edited = await save(
      { ...draft, counts: { ...draft.counts, student: 12 } },
      1,
    );
    assert.deepEqual(edited.shift.rates_snapshot, rates);
    assert.equal(edited.shift.version, 2);
    const backdated = await save({
      ...draft,
      id: "33333333-3333-4333-8333-333333333333",
      workDate: "2026-09-01",
      startAt: "2026-09-01T06:00:00Z",
      endAt: "2026-09-01T14:00:00Z",
    });
    assert.deepEqual(backdated.shift.rates_snapshot, rates);
    const future = await save({
      ...draft,
      id: "44444444-4444-4444-8444-444444444444",
      workDate: "2026-11-01",
      startAt: "2026-11-01T07:00:00Z",
      endAt: "2026-11-01T15:00:00Z",
    });
    assert.deepEqual(future.shift.rates_snapshot, checker);
  });
  await test("stale edit and deletion blocked", async () => {
    await rejects(
      () => save({ ...draft, notes: "stale" }, 1),
      "PACKTRACK_CONFLICT",
    );
    await rejects(
      () => db.query("select public.delete_shift($1,1)", [S]),
      "PACKTRACK_CONFLICT",
    );
  });
  await test("explicit compensation override works", async () => {
    const edited = await save(draft, 2, checker);
    assert.deepEqual(edited.shift.rates_snapshot, checker);
    assert.equal(edited.shift.version, 3);
  });
  await test("invalid bonus fails atomically", async () => {
    await rejects(
      () =>
        save(
          { ...draft, bonuses: [{ amount: 1.5, description: "invalid" }] },
          3,
        ),
      "PACKTRACK_INVALID_INPUT",
    );
    const result = await db.query(
      "select version from public.shifts where id=$1",
      [S],
    );
    assert.equal(result.rows[0].version, 3);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.shift_bonuses where shift_id=$1",
          [S],
        )
      ).rows[0].count,
      2,
    );
  });
  await test("missing rate, malformed rates, negative time, bad break and date spoof blocked", async () => {
    await rejects(
      () => save({ ...draft, counts: { ...draft.counts, privateSolo: 1 } }, 3),
      "PACKTRACK_MISSING_RATES",
    );
    await rejects(
      () => save(draft, 3, { ...checker, hourlyRate: null }),
      "PACKTRACK_MISSING_RATES",
    );
    await rejects(
      () => setRates("2026-12-01", { ...rates, role: null }),
      "PACKTRACK_INVALID_INPUT",
    );
    await rejects(
      () => setRates("2026-12-01", { ...rates, hourlyAdjustment: -5000 }),
      "PACKTRACK_INVALID_INPUT",
    );
    await rejects(
      () => save({ ...draft, endAt: draft.startAt }, 3),
      "PACKTRACK_INVALID_INPUT",
    );
    await rejects(
      () => save({ ...draft, breakMinutes: 480 }, 3),
      "PACKTRACK_INVALID_INPUT",
    );
    await rejects(
      () => save({ ...draft, workDate: "2026-10-02" }, 3),
      "PACKTRACK_INVALID_INPUT",
    );
  });
  await test("direct table writes denied even to owner", async () => {
    await rejects(
      () =>
        db.query("update public.shifts set notes=$1 where id=$2", [
          "direct write",
          S,
        ]),
      "permission denied",
    );
    await rejects(
      () => db.query("delete from public.shifts where id=$1", [S]),
      "permission denied",
    );
    await rejects(
      () =>
        db.query(
          "insert into public.shift_bonuses(user_id,shift_id,amount,position) values($1,$2,100,3)",
          [B, S],
        ),
      "permission denied",
    );
  });
  await asUser(B);
  await test("second user cannot read first user profiles, rates, shifts or bonuses", async () => {
    assert.deepEqual((await db.query("select id from public.profiles")).rows, [
      { id: B },
    ]);
    assert.equal(
      (await db.query("select * from public.shifts")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.shift_bonuses")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.compensation_history where user_id=$1",
          [A],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select rates from public.compensation_history")).rows[0]
        .rates.studentRate,
      null,
    );
  });
  await test("second user cannot edit/delete/hijack first user shift via RPC", async () => {
    await rejects(
      () => save({ ...draft, notes: "attack" }, 3),
      "PACKTRACK_NOT_FOUND",
    );
    await rejects(
      () => db.query("select public.delete_shift($1,3)", [S]),
      "PACKTRACK_NOT_FOUND",
    );
    await setRates("1900-01-01", checker);
    await rejects(() => save(draft, 0), "PACKTRACK_CONFLICT");
  });
  await test("foreign keys prohibit cross-user bonuses independent of grants", async () => {
    await db.exec("reset role");
    await rejects(
      () =>
        db.query(
          "insert into public.shift_bonuses(user_id,shift_id,amount,position) values($1,$2,100,3)",
          [B, S],
        ),
      "foreign key",
    );
    await asUser(B);
  });
  await test("anonymous users cannot read or call mutation RPCs", async () => {
    await db.exec("reset role; set role anon");
    await rejects(
      () => db.query("select * from public.shifts"),
      "permission denied",
    );
    await rejects(() => save(draft), "permission denied");
  });
  await test("deleting owned shift cascades its bonuses", async () => {
    await asUser(A);
    await db.query("select public.delete_shift($1,3)", [S]);
    assert.equal(
      (
        await db.query("select * from public.shift_bonuses where shift_id=$1", [
          S,
        ])
      ).rows.length,
      0,
    );
  });
  console.log(
    `\n${passed} PostgreSQL migration/security tests passed. Supabase hosted Auth/PostgREST integration was not exercised.`,
  );
} catch (error) {
  console.error(
    "FAIL PostgreSQL test:",
    error.message,
    error.code ?? "",
    error.position ?? "",
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
