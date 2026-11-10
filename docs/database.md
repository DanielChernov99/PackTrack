# Database and authorization

The initial migration is `supabase/migrations/202611090001_packtrack.sql`. It targets PostgreSQL 17 and requires Supabase's `auth.users`, `auth.uid()`, `anon` and `authenticated` roles. No application server or privileged browser credential is required.

| Table | Purpose | Ownership |
| --- | --- | --- |
| `profiles` | Account identity and timestamps; no passwords or duplicated email | Primary key equals Auth user UUID |
| `compensation_history` | Effective-dated role and compensation, unique per user/date | `user_id` |
| `shifts` | Jerusalem work date, UTC start/end, break, counts, immutable-by-default rate snapshot, optimistic version | `user_id` |
| `shift_bonuses` | Ordered signed money adjustments saved transactionally with a shift | Composite `(shift_id,user_id)` foreign key |

Rates and counts are small validated JSON objects. Rates contain `role`, `hourlyRate`, `hourlyAdjustment`, `creditedMinutes`, `studentRate`, `sigmaRate`, `privateSharedRate`, and `privateSoloRate`. All money values are integer agorot. Unknown rates are JSON `null`; zero is an intentionally configured zero rate. Rates are bounded to 1,000,000 agorot, each bonus to ±10,000,000 agorot, and counts to 10,000 per category.

Registration creates a profile and compensation baseline effective `1900-01-01`. This makes the user's initial chosen role apply to backdated entries until a more specific dated configuration is added. This is a starting configuration, not proof of historical employment: users should enter earlier role/rate changes before recording old shifts. Only regular packers get the three known piece defaults (1100,1100,900 agorot); every other unknown rate remains null. Existing Auth identities present when the migration is applied receive a profile and an unconfigured hourly rate.

`set_compensation(date,rates)` creates or replaces the configuration effective on that exact date. The latest effective date on or before a new shift's work date is used. Replacement never rewrites saved shifts. `save_shift` takes a client-generated UUID, expected version, and optional explicit historical override. New shifts get their snapshot on the database server; edits retain the stored snapshot even if the work date changes. An override replaces the snapshot only for that saved shift.

The `save_shift` RPC validates money, counts, timestamps, local date/time consistency, positive payable duration, breaks and required rates. It saves the shift and all bonuses in one database transaction. Bonuses are replaced atomically, so their UUIDs are not stable across edits. A per-user profile row lock serializes saves, deletes and compensation updates, preventing concurrent overlap checks from racing. Half-open time intervals permit adjacent shifts. The expected version rejects stale edits. Repeating an identical most-recent request returns its original result without creating duplicate bonuses or incrementing the version. Changing data after a lost response requires a reload if the previous request succeeded.

The database stores source values rather than trusting client-supplied earnings totals. Calculations use the saved UTC interval and snapshot through `src/domain`; hourly pay is rounded once to the nearest agora. Work is attributed wholly to the shift's start date in `Asia/Jerusalem`. Credited minutes add paid time but do not extend the interval used for overlap checks.

## Authorization

Every exposed application table has RLS enabled, with `auth.uid()` ownership checks in both `USING` and `WITH CHECK`. Authenticated clients receive only `SELECT` on these tables; direct INSERT/UPDATE/DELETE is denied even for their own rows. Anonymous clients receive no application-table access. Writes use three narrowly scoped `SECURITY DEFINER` functions with an empty search path and explicit identity checks: `save_shift`, `delete_shift`, `set_compensation`. Their EXECUTE grants are restricted to `authenticated`. All helper functions are private. The Auth trigger is the only profile initializer.

`shift_bonuses` cannot point at a different owner's shift even for a privileged process because its foreign key includes both the shift ID and owner ID. The RPCs never accept an owner ID from callers. UUID collisions cannot transfer ownership. The database owner and Supabase service role can bypass RLS by design; neither credential belongs in the browser.

## Executable verification

`node scripts/test-database.mjs` executes the actual migration on embedded PostgreSQL (PGlite) with a minimal Auth schema/identity-function shim. It uses actual PostgreSQL roles and RLS with two synthetic identities. Tests cover migration validity, defaults, private reads, denied direct writes, RPC ownership, composite foreign keys, atomic bonus writes, validation, snapshots, effective dates, retries, conflicts, overlap checks and cascade deletion. It does not test Supabase's real Auth service, JWT verification, PostgREST, email delivery or simultaneous database connections.

For a separately authorized disposable Supabase project, first create two confirmed test accounts, apply the migrations, and set these **process environment variables** (never commit credentials):

```text
PACKTRACK_RUN_LIVE_TESTS=yes
PACKTRACK_TEST_URL=<project URL>
PACKTRACK_TEST_PUBLISHABLE_KEY=<publishable key>
PACKTRACK_TEST_EMAIL_A=<disposable account A>
PACKTRACK_TEST_PASSWORD_A=<account A password>
PACKTRACK_TEST_EMAIL_B=<disposable account B>
PACKTRACK_TEST_PASSWORD_B=<account B password>
```

Then run `node scripts/test-rls.mjs`. It signs in normally and performs direct API requests using each user's session. It creates and removes one uniquely identified synthetic shift per account on 2099-01-15, leaving compensation history untouched. Accounts must have no overlapping shift at 09:00–10:00 that day. Cleanup errors identify only the synthetic record UUID. Without the explicit opt-in and credentials, it prints **SKIP** and sends no requests. Do not run it against personal production accounts.

See the main README for the pinned CLI's local/hosted migration commands. Hosted migrations and live integration tests require the project owner's explicit action; none are executed automatically by the application.
