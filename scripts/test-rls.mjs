/** Opt-in integration verification against two disposable Supabase test users.
 * Never runs as part of the default test command. Does not use admin keys. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const names = [
  "PACKTRACK_TEST_URL",
  "PACKTRACK_TEST_PUBLISHABLE_KEY",
  "PACKTRACK_TEST_EMAIL_A",
  "PACKTRACK_TEST_PASSWORD_A",
  "PACKTRACK_TEST_EMAIL_B",
  "PACKTRACK_TEST_PASSWORD_B",
];
if (
  process.env.PACKTRACK_RUN_LIVE_TESTS !== "yes" ||
  names.some((name) => !process.env[name])
) {
  console.log(
    "SKIP: live Supabase authorization tests require PACKTRACK_RUN_LIVE_TESTS=yes and six PACKTRACK_TEST_* variables. See docs/database.md. No requests were sent.",
  );
  process.exit(0);
}
assert.ok(
  process.env.PACKTRACK_TEST_PUBLISHABLE_KEY.startsWith("sb_publishable_"),
  "Use a publishable key only.",
);
const clients = ["A", "B"].map(() =>
  createClient(
    process.env.PACKTRACK_TEST_URL,
    process.env.PACKTRACK_TEST_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ),
);
const ids = [randomUUID(), randomUUID()];
const snapshots = {
  role: "regular",
  hourlyRate: 3500,
  hourlyAdjustment: 0,
  creditedMinutes: 0,
  studentRate: 1100,
  sigmaRate: 1100,
  privateSharedRate: 900,
  privateSoloRate: null,
};
const fixture = (id) => ({
  id,
  workDate: "2099-01-15",
  startTime: "09:00",
  endTime: "10:00",
  endNextDay: false,
  timeDisambiguation: "reject",
  startAt: "2099-01-15T07:00:00Z",
  endAt: "2099-01-15T08:00:00Z",
  breakMinutes: 0,
  counts: { student: 1, sigma: 0, privateShared: 0, privateSolo: 0 },
  bonuses: [{ amount: 100, description: "Temporary RLS integration fixture" }],
  notes: "Temporary RLS integration fixture",
});
const users = [];
try {
  for (const [index, label] of ["A", "B"].entries()) {
    const result = await clients[index].auth.signInWithPassword({
      email: process.env[`PACKTRACK_TEST_EMAIL_${label}`],
      password: process.env[`PACKTRACK_TEST_PASSWORD_${label}`],
    });
    assert.ifError(result.error);
    assert.ok(result.data.user);
    users.push(result.data.user.id);
  }
  assert.notEqual(users[0], users[1], "Two distinct test users are required.");
  for (let index = 0; index < 2; index++) {
    const result = await clients[index].rpc("save_shift", {
      p_shift: fixture(ids[index]),
      p_expected_version: 0,
      p_override: snapshots,
    });
    assert.ifError(result.error);
  }
  for (let index = 0; index < 2; index++) {
    const client = clients[index];
    const other = 1 - index;
    for (const [table, column, value] of [
      ["profiles", "id", users[other]],
      ["compensation_history", "user_id", users[other]],
      ["shifts", "id", ids[other]],
      ["shift_bonuses", "shift_id", ids[other]],
    ]) {
      const result = await client.from(table).select("*").eq(column, value);
      assert.ifError(result.error);
      assert.equal(
        result.data.length,
        0,
        `${table}: foreign data must be invisible`,
      );
    }
    const directUpdate = await client
      .from("shifts")
      .update({ notes: "unauthorized" })
      .eq("id", ids[other]);
    assert.ok(directUpdate.error, "Direct shift UPDATE must be denied");
    const directDelete = await client
      .from("shifts")
      .delete()
      .eq("id", ids[other]);
    assert.ok(directDelete.error, "Direct shift DELETE must be denied");
    const fakeBonus = await client.from("shift_bonuses").insert({
      shift_id: ids[other],
      user_id: users[index],
      amount: 100,
      position: 2,
      description: "unauthorized",
    });
    assert.ok(fakeBonus.error, "Foreign bonus reference must fail");
    const foreignEdit = await client.rpc("save_shift", {
      p_shift: fixture(ids[other]),
      p_expected_version: 1,
    });
    assert.ok(foreignEdit.error?.message.includes("PACKTRACK_NOT_FOUND"));
    const foreignDelete = await client.rpc("delete_shift", {
      p_id: ids[other],
      p_expected_version: 1,
    });
    assert.ok(foreignDelete.error?.message.includes("PACKTRACK_NOT_FOUND"));
  }
  console.log(
    "PASS: two-user Auth + PostgREST isolation; foreign profile/rates/shifts/bonuses reads, direct writes, RPC edits/deletes and forged bonus references blocked.",
  );
} finally {
  for (let index = 0; index < 2; index++) {
    const result = await clients[index].rpc("delete_shift", {
      p_id: ids[index],
      p_expected_version: 1,
    });
    if (
      result.error &&
      !result.error.message.includes("PACKTRACK_NOT_FOUND") &&
      users[index]
    )
      console.error(
        `Cleanup failed for synthetic shift ${ids[index]}; remove it through its test account.`,
      );
    await clients[index].auth.signOut();
  }
}
