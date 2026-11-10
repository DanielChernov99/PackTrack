# PackTrack · כל קיפול נחשב

A mobile-first Hebrew RTL application for parachute packers to record shifts, packing quantities, manual adjustments, and estimated gross earnings.

**Project directory:** `D:\Daniel\PackTrack`

**Status:** implemented and locally tested; a Supabase project must be configured before real accounts or shifts can be used. There is no demo database or fake production login.

## What works

- Supabase email/password registration, confirmation, persistent login, logout, password recovery, email changes, and password reauthentication.
- Three packer roles with configurable hourly and piece rates. Only the known regular-packer rates are prefilled: student ₪11, Sigma ₪11, shared private ₪9. Solo/private, hourly wages, and other-role rates remain unconfigured.
- Effective-dated compensation and role history. New shifts use the applicable configuration on their work date. Edits preserve the saved snapshot; a deliberate advanced override corrects one historical shift.
- Shift creation/editing/deletion, unpaid breaks, overnight work, four packing categories, multiple signed bonuses, notes, and live estimates.
- Current-month dashboard, month/year history, annual charts, accessible data tables, light/dark themes, and responsive navigation.
- UTC instants with Jerusalem calendar dates, daylight-saving validation, server-enforced overlap prevention, atomic saves, optimistic concurrency, and retry protection.
- Install manifest, icons, and a public static/offline shell. Account and earnings responses are never stored in the service-worker cache.

## Run locally

Use Node.js **22.12 or newer** and npm. From PowerShell:

```powershell
Set-Location D:\Daniel\PackTrack
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173). Do not overwrite an existing `.env.local`; edit it instead. Without configuration, the application displays an actionable setup screen.

Set these two values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

Only the public **publishable** key belongs here. The application deliberately rejects secret keys and legacy JWT keys. Restart Vite after changing environment variables. Vite embeds these public values at build time.

## Configure Supabase

No tables need to be created manually. The complete schema, constraints, functions, Auth bootstrap trigger, and RLS policies are in `supabase/migrations/202611090001_packtrack.sql`.

The lockfile pins **Supabase CLI 2.122.1**. Commands below were checked against that installed version; it uses `--linked`, rather than the newer CLI's `--remote`.

### Optional local Supabase stack

Requires Docker Desktop (not required for the pure application or embedded PostgreSQL tests):

```powershell
npx supabase start
npx supabase db push --local
npx supabase status
```

Use the printed local API URL and publishable key in `.env.local`. Local email messages appear in the local mail UI printed by the CLI. Do not run `db reset` against a stack containing data you need.

### Hosted project, when you are ready

These are manual operator instructions. No hosted migration or hosted mutation was executed during implementation.

1. Create a dedicated Supabase project and obtain its URL and publishable key.
2. Authenticate the CLI and link **that intended project**:
   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --linked --dry-run
   ```
3. Review the pending migration and back up any existing application data. Apply it only after approving the target:
   ```powershell
   npx supabase db push --linked
   ```
4. In Auth settings, enable email/password signup and email confirmation. Set minimum password length to at least 10, enable secure email change and secure password change. Hosted Auth settings are separate from the local CLI config.
5. Set the Site URL to your app origin and allow these exact callback paths on that origin:
   - `http://127.0.0.1:5173/auth/callback`
   - `http://127.0.0.1:5173/auth/reset`
   - Also add the localhost variants if you use localhost, and the HTTPS production variants when deployed.
6. Configure a suitable SMTP provider for public use, review Auth rate limits, and test verification, recovery, and email change delivery. The PKCE email flow must finish in the same browser where it started.
7. Add the public environment variables, restart the app, register, and set your actual hourly wage and any missing packing rates before recording work.

For an existing project with unrelated objects, review the migration for naming/trigger conflicts first. Never repair migration history or overwrite existing tables blindly.

Provider references: [CLI local development](https://supabase.com/docs/guides/local-development/cli-workflows), [password Auth](https://supabase.com/docs/guides/auth/passwords), [API keys](https://supabase.com/docs/guides/api/api-keys).

## Development and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite development server |
| `npm run typecheck` | Strict TypeScript checking |
| `npm run lint` | ESLint, including React hooks |
| `npm test` | Domain, adapter, auth, and form tests |
| `npm run test:db` | Real migration and RLS on embedded PostgreSQL |
| `npm run build` | Type check and production build to dist |
| `npm run preview` | Preview the production build |
| `npm run check` | TypeScript, lint, unit/component tests, SQL tests, build |
| `npm run test:e2e` | Desktop/mobile browser workflows (build first) |
| `npm run test:rls` | Explicitly opted-in live two-user Supabase test |
| `npm run format:check` | Check source formatting |
| `npm audit` | Check dependencies against current advisories |

Browser tests use installed Google Chrome by default and start isolated loopback servers on ports 5174 and 4173. They intercept the test Supabase endpoint with synthetic responses; the real SDK, adapters, forms, navigation, and calculations run unchanged. No test service is bundled into production.

To use Playwright's Chromium instead:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run build
npm run test:e2e
```

The production configuration/offline test expects a build with **blank Supabase variables**. If you already configured `.env.local`, set both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to empty process values before building that test artifact, then restore your normal environment and rebuild for real use. Do not deploy the unconfigured test build.

See [verification results and limits](docs/verification.md). Live Supabase testing is deliberately excluded from default checks; setup and its opt-in environment are in [database documentation](docs/database.md).

## Architecture

```text
src/
  components/        Shared UI, branding, rate fields
  pages/             Dashboard, shifts, analytics, profile, authentication
  app/               Authenticated context and data-loading hooks
  domain/            Pure models, Zod validation, time and pay calculations
  data/contracts.ts  Repository and authentication interfaces
  data/index.ts      Supabase adapters; the only runtime SDK integration
  data/database.types.ts
supabase/            Local configuration and version-controlled migration
scripts/             PostgreSQL and opt-in live authorization tests
tests/e2e/           Browser workflows and isolated synthetic API responses
public/              PWA shell, icons, static hosting headers/rewrites
```

React components do not call the Supabase SDK. Repository methods expose shifts, profiles, and compensation history. The domain layer does not depend on React or Supabase.

**Stack:** React, strict TypeScript, Vite, Mantine, Recharts, React Router, Lucide, Zod, Temporal polyfill, Supabase Auth/PostgreSQL, Vitest, Testing Library, Playwright. Fonts are self-hosted. The embedded PostgreSQL package is a development dependency used only for tests.

See [schema and RLS](docs/database.md), [pay calculation rules](docs/compensation.md), and [portability and backups](docs/portability.md).

## Production deployment

Build with the correct public variables using `npm run build`, then serve `dist/` over HTTPS. This is a static SPA: configure fallback to `index.html` for routes such as `/shifts/new` and the auth callback paths. The included `_redirects` and `_headers` files are supported by compatible static hosts (for example Netlify); other hosts need equivalent configuration. They do not configure hosted Supabase.

Set no-cache for HTML and `sw.js`; hashed assets can use long-lived caching. The sample CSP allows HTTPS connections; narrow `connect-src` to your project's exact HTTPS/WSS origin at deployment if practical. Keep `frame-ancestors 'none'`, no-sniff, and the referrer policy.

Set the final Auth Site URL and redirect allowlist. On iPhone, use Safari's Share → Add to Home Screen; on supported desktop/Android browsers, use Install. No offline write queue is implemented. If disconnected, the offline screen explains that a connection is required.

## Security

- RLS on every exposed application table; owner checks on both read and write policies.
- Direct application-table writes are revoked. Authenticated RPCs check identity, serialize per-user writes, and save bonuses transactionally.
- Composite owner foreign keys prevent cross-account references. No client-supplied totals are trusted.
- Passwords remain in Supabase Auth. No service-role key, access token, database password, or personal record is tracked.
- The Supabase SDK stores persistent session tokens in browser storage. Use a trusted device and log out on shared devices. Salary responses are not cached by the service worker.
- `.env*`, credentials, local backups, build outputs, dependencies, Supabase temporary files, and test reports are ignored.
- Do not commit database exports, browser traces from real accounts, or real salary screenshots.

## Screenshots

Run the browser suite to generate `test-results/dashboard-desktop.png`, `dashboard-mobile.png`, `shift-*.png`, and `analytics-*.png`. These use clearly synthetic identities and test compensation. Use `npx playwright show-report` for failures and traces. Capture only synthetic data for public documentation.

## Limitations and next steps

- Hosted Auth, email delivery, real PostgREST isolation, and true multi-connection concurrency still need verification against an authorized configured project.
- Local SQL tests use real PostgreSQL RLS with a minimal Auth identity shim; they are not a replacement for the optional live integration suite.
- Browser checks cover Chromium desktop and mobile emulation; physical iPhone/Safari installation is not yet verified.
- Estimates are gross amounts, without tax or payroll deductions. Unknown club compensation rules must be entered by the user.
- New accounts get a baseline configuration dated 1900-01-01. Enter the correct historical role/rate changes before adding old shifts.
- Shifts are limited to 24 actual hours; one DST occurrence choice applies to both endpoints. Entire overnight shifts belong to their start month.
- No offline synchronization, automatic bonus rules, payroll submission, account-deletion UI, or currency conversion.
- Potential follow-ups: user-requested CSV export, physical Safari verification, deployment monitoring, and an authorized hosted integration run.

## Repository continuity

The original commit `118e407`, `main`, and `origin` were preserved. Work is on `codex/packtrack-app`; nothing has been pushed. The canonical repository is **D:\Daniel\PackTrack**. The earlier C: source copy was archived under ignored `.local-backups/` before removal. This backup is local preservation material and must not be published.
