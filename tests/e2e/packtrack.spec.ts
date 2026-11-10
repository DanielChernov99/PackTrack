import { expect, test, type Page } from "@playwright/test";
import {
  defaultRates,
  monthInJerusalem,
  resolveShiftTimes,
} from "../../src/domain";
import type {
  BonusRow,
  CompensationRow,
  ShiftRow,
} from "../../src/data/database.types";
const userId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const currentMonth = monthInJerusalem();
const baseRates = { ...defaultRates("regular"), hourlyRate: 4000 };
async function fixtureApi(page: Page) {
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "packer@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    identities: [],
  };
  const shifts: ShiftRow[] = [2, 4, 6].map((day, i) => {
    const workDate = currentMonth + "-" + String(day).padStart(2, "0");
    const times = resolveShiftTimes({
      id: crypto.randomUUID(),
      workDate,
      startTime: "08:00",
      endTime: "16:00",
      endNextDay: false,
      timeDisambiguation: "reject",
      breakMinutes: 30,
      counts: { student: 12, sigma: 8, privateShared: 2, privateSolo: 0 },
      bonuses: [],
      notes: "",
    });
    return {
      id: "11111111-1111-4111-8111-" + String(i + 1).padStart(12, "0"),
      user_id: userId,
      work_date: workDate,
      start_at: times.startAt,
      end_at: times.endAt,
      break_minutes: 30,
      counts: { student: 12, sigma: 8, privateShared: 2, privateSolo: 0 },
      rates_snapshot: baseRates,
      notes: "Synthetic browser test only",
      time_disambiguation: "reject",
      version: 1,
      created_at: times.startAt,
      updated_at: times.startAt,
      last_request: {},
    };
  });
  const bonuses: BonusRow[] = [];
  const history: CompensationRow[] = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: userId,
      effective_from: "1900-01-01",
      rates: baseRates,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  let savedPayload: Record<string, unknown> | null = null;
  await page.route("http://127.0.0.1:54329/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = route.request().postDataJSON();
    const reply = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(value),
        headers: { "access-control-allow-origin": "*" },
      });
    if (route.request().method() === "OPTIONS") return reply({}, 200);
    if (path.endsWith("/token")) {
      const encode = (x: unknown) =>
        Buffer.from(JSON.stringify(x)).toString("base64url");
      return reply({
        access_token:
          encode({ alg: "HS256", typ: "JWT" }) +
          "." +
          encode({
            sub: userId,
            role: "authenticated",
            exp: Math.floor(Date.now() / 1000) + 3600,
          }) +
          ".test-signature",
        refresh_token: "synthetic-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    if (path.endsWith("/logout")) return reply(null, 204);
    if (path.endsWith("/user")) return reply(user);
    if (
      path.endsWith("/recover") ||
      path.endsWith("/resend") ||
      path.endsWith("/reauthenticate")
    )
      return reply({});
    if (path.endsWith("/signup"))
      return reply({
        ...user,
        identities: [{ id: userId, provider: "email" }],
      });
    if (path.endsWith("/compensation_history")) return reply(history);
    if (path.endsWith("/profiles"))
      return reply({
        id: userId,
        created_at: user.created_at,
        updated_at: user.created_at,
      });
    if (path.endsWith("/shifts")) {
      let rows = [...shifts];
      const id = url.searchParams.get("id");
      if (id) return reply(rows.find((x) => x.id === id.slice(3)) ?? null);
      for (const filter of url.searchParams.getAll("work_date")) {
        const date = filter.slice(filter.indexOf(".") + 1);
        rows = rows.filter((x) =>
          filter.startsWith("gte.") ? x.work_date >= date : x.work_date < date,
        );
      }
      return reply(rows.sort((a, b) => b.work_date.localeCompare(a.work_date)));
    }
    if (path.endsWith("/shift_bonuses")) {
      const filter = url.searchParams.get("shift_id") ?? "";
      return reply(bonuses.filter((x) => filter.includes(x.shift_id)));
    }
    if (path.endsWith("/rpc/save_shift")) {
      savedPayload = body;
      const d = body.p_shift;
      const found = shifts.find((x) => x.id === d.id);
      const snapshot =
        body.p_override ??
        found?.rates_snapshot ??
        history
          .filter((x) => x.effective_from <= d.workDate)
          .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
          .rates;
      const row: ShiftRow = {
        id: d.id,
        user_id: userId,
        work_date: d.workDate,
        start_at: d.startAt,
        end_at: d.endAt,
        break_minutes: d.breakMinutes,
        counts: d.counts,
        rates_snapshot: snapshot,
        notes: d.notes,
        time_disambiguation: d.timeDisambiguation,
        version: (found?.version ?? 0) + 1,
        created_at: found?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_request: {},
      };
      if (found) shifts.splice(shifts.indexOf(found), 1, row);
      else shifts.push(row);
      for (let i = bonuses.length - 1; i >= 0; i--)
        if (bonuses[i].shift_id === d.id) bonuses.splice(i, 1);
      const added: BonusRow[] = d.bonuses.map(
        (b: { amount: number; description: string }, position: number) => ({
          id: crypto.randomUUID(),
          shift_id: d.id,
          user_id: userId,
          amount: b.amount,
          description: b.description,
          position,
          created_at: new Date().toISOString(),
        }),
      );
      bonuses.push(...added);
      return reply({ shift: row, bonuses: added });
    }
    if (path.endsWith("/rpc/delete_shift")) {
      const index = shifts.findIndex((x) => x.id === body.p_id);
      if (index >= 0) shifts.splice(index, 1);
      return reply(null, 204);
    }
    if (path.endsWith("/rpc/set_compensation")) {
      expect(Object.keys(body.p_rates)).toHaveLength(8);
      const row = {
        id: crypto.randomUUID(),
        user_id: userId,
        effective_from: body.p_effective_from,
        rates: body.p_rates,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      history.push(row);
      return reply(row);
    }
    throw new Error("Unexpected mocked API request: " + path);
  });
  return {
    shifts,
    bonuses,
    history,
    get savedPayload() {
      return savedPayload;
    },
  };
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("כתובת אימייל").fill("packer@example.test");
  await page.getByLabel("סיסמה").fill("Test-only-password");
  await page.getByRole("button", { name: "כניסה לחשבון" }).click();
  await expect(
    page.getByRole("heading", { name: "יום טוב, נחיתה רכה." }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("RTL dashboard, navigation, responsive charts and settings", async ({
  page,
}, info) => {
  await fixtureApi(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".hero-total")).toContainText("1,614");
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/dashboard-" + info.project.name + ".png",
    fullPage: true,
  });
  const nav = page.getByRole("navigation", {
    name: info.project.name === "mobile" ? "ניווט בנייד" : "ניווט ראשי",
  });
  await nav
    .getByRole("link", {
      name: info.project.name === "mobile" ? "תובנות" : "תמונת מצב",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "התמונה הגדולה" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/analytics-" + info.project.name + ".png",
    fullPage: true,
  });
  await nav
    .getByRole("link", {
      name: info.project.name === "mobile" ? "פרופיל" : "הפרופיל שלי",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "הפרופיל שלי" }),
  ).toBeVisible();
  await noOverflow(page);
  await page
    .getByRole("button", { name: "שמור תנאי שכר", exact: true })
    .click();
  await page.getByRole("button", { name: "אישור ושמירה" }).click();
  await expect(page.getByText("הגדרות השכר נשמרו")).toBeVisible();
  await page.getByText("כהה", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    "dark",
  );
  await noOverflow(page);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "התנתקות מהחשבון" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "התנתקות", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "כניסה לחשבון" }),
  ).toBeVisible();
  await page.goto("/shifts");
  await expect(
    page.getByRole("button", { name: "כניסה לחשבון" }),
  ).toBeVisible();
});

test("create, edit, switch to new and delete a shift through real UI and adapter", async ({
  page,
}, info) => {
  const api = await fixtureApi(page);
  await login(page);
  await page.goto("/shifts/new");
  await expect(
    page.getByRole("heading", { name: "הוסף משמרת", exact: true }),
  ).toBeVisible();
  await page.getByLabel("תאריך המשמרת").fill(currentMonth + "-15");
  await page.getByLabel("כמות חניך", { exact: true }).fill("3");
  await page.getByLabel("כמות סיגמה", { exact: true }).fill("2");
  await page.getByLabel("הפסקה ללא תשלום", { exact: true }).fill("30");
  await page.getByRole("button", { name: "הוסף בונוס" }).click();
  await page.getByLabel("סכום התאמה 1", { exact: true }).fill("-12.50");
  await page.getByLabel("תיאור ההתאמה").fill("Test adjustment");
  await expect(page.locator(".estimate-total")).toContainText("342.50");
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/shift-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "שמור משמרת", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "המשמרות שלי" }),
  ).toBeVisible();
  expect(api.shifts).toHaveLength(4);
  const saved = api.shifts[3];
  expect(api.bonuses.find((b) => b.shift_id === saved.id)?.amount).toBe(-1250);
  await page.locator('a[href="/shifts/' + saved.id + '"]').click();
  await expect(
    page.getByRole("heading", { name: "עריכת משמרת" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "הוסף חניך", exact: true }).click();
  await expect(page.locator(".estimate-total")).toContainText("353.50");
  await page.getByRole("button", { name: "שמור שינויים" }).click();
  await expect(
    page.getByRole("heading", { name: "המשמרות שלי" }),
  ).toBeVisible();
  expect(api.shifts.find((s) => s.id === saved.id)?.version).toBe(2);
  await page.locator('a[href="/shifts/' + saved.id + '"]').click();
  await expect(
    page.getByRole("heading", { name: "עריכת משמרת" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("link", { name: "הוסף משמרת", exact: true }).click();
  else {
    await page.getByRole("link", { name: "לכל המשמרות" }).click();
    await page.getByRole("link", { name: "הוסף משמרת", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "הוסף משמרת", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("כמות חניך", { exact: true })).toHaveValue("0");
  await page.getByLabel("תאריך המשמרת").fill("");
  await expect(page.getByText("נדרש עדכון לפני שמירה")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "שמור משמרת", exact: true }),
  ).toBeDisabled();
  await page.goto("/shifts");
  await page
    .getByRole("button", {
      name: "מחק משמרת " + currentMonth + "-15",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "מחק משמרת", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(api.shifts).toHaveLength(3);
});

test("session restoration and password recovery survive refresh", async ({
  page,
}) => {
  await fixtureApi(page);
  await login(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "יום טוב, נחיתה רכה." }),
  ).toBeVisible();
  await page.goto("/auth/reset");
  await expect(
    page.getByRole("heading", { name: "בוחרים סיסמה חדשה" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "בוחרים סיסמה חדשה" }),
  ).toBeVisible();
  await page.getByLabel("סיסמה חדשה").fill("New-test-password");
  await page.getByLabel("אימות סיסמה").fill("New-test-password");
  await page.getByRole("button", { name: "שמירת סיסמה חדשה" }).click();
  await expect(
    page.getByRole("heading", { name: "יום טוב, נחיתה רכה." }),
  ).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("unconfigured production build and private-data-free offline fallback", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4173");
  await expect(
    page.getByRole("heading", { name: "הבית החדש למשמרות שלך." }),
  ).toBeVisible();
  await expect(page.getByText("נדרשת הגדרה ראשונית")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      for (const req of await (await caches.open(name)).keys())
        urls.push(req.url);
    }
    return urls;
  });
  expect(
    cached.every(
      (url) =>
        !url.includes("supabase") &&
        !url.includes("/auth/") &&
        !url.includes("/rest/"),
    ),
  ).toBe(true);
  await context.setOffline(true);
  await page.goto("http://127.0.0.1:4173/");
  await expect(
    page.getByRole("heading", { name: "ניפגש כשיחזור החיבור." }),
  ).toBeVisible();
  await context.setOffline(false);
});
