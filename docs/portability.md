# Portability and backup

React components consume `PackTrackRepository` and `AuthAdapter` from `src/data/contracts.ts`. `src/data/index.ts` is the only runtime module that imports the Supabase SDK. The pure `src/domain` module contains the pay and time rules. `src/data/database.types.ts` describes the version-controlled public database schema.

To move to another PostgreSQL provider:

1. Export the application schema and data, including shift snapshots, versions, bonuses, compensation effective dates and UUID ownership. Never reconstruct past snapshots from current settings.
2. Provision equivalent tables, constraints, indexes and transactional behavior on the new database. The `auth.users` foreign key, `auth.uid()` policies, profile trigger and Supabase role grants are the provider-specific SQL. Replace them with the new identity table and trusted request identity. Never accept `user_id` directly from an unauthenticated client.
3. Implement the repository contract over a small authenticated REST service. Each endpoint must enforce ownership server-side. Save the shift and bonuses in one transaction and retain the per-user lock, overlap check, idempotency behavior and expected-version checks. Preserve decimal-free integer agorot and UTC timestamps.
4. Implement the auth adapter for the replacement identity provider, including password recovery, verification and session events. Supabase Auth password hashes and sessions are not an ordinary application-table export; plan a supported identity migration or password reset rather than copying plaintext passwords.
5. Inject the replacement `AppServices` in the application provider. Domain calculations and UI pages should not change. Run the domain, component, database and two-user authorization suites against the replacement.

## Backup and restore

Use managed Supabase backups/PITR according to the project's plan. Also retain encrypted, access-controlled logical exports outside the application repository. A `pg_dump` of the application schema/data must include all four public tables and `app_private` functions; capture the schema and data together at one consistent database snapshot. The Supabase CLI's dump command typically excludes provider-managed schemas, so treat Auth identities as a separate restoration requirement. Review the current CLI help before choosing flags and ensure the destination is an approved private location.

For a complete migration/restore, map the same Auth user UUIDs before loading `profiles` and dependent rows. Restore in dependency order (identities, profiles, compensation, shifts, bonuses), or use a transaction with a verified dump format that preserves constraints. Restore into a disposable project first, run the security tests and compare row counts and earnings from saved snapshots. A backup has not been verified until a restore has succeeded.

Do not place exports, access tokens, database connection strings or passwords in Git, frontend environment files, screenshots or issue reports. The browser publishable key is intentionally public; database credentials and service-role keys are not.

Provider references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [database backups](https://supabase.com/docs/guides/platform/backups), [PKCE sessions](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows).
