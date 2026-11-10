import { createClient, type Session } from "@supabase/supabase-js";
import {
  ratesSchema,
  resolveShiftTimes,
  type Compensation,
  type Rates,
  type Shift,
  type ShiftDraft,
} from "../domain";
import type { AppServices, AuthSession, PublicEnvironment } from "./contracts";
import type {
  BonusRow,
  CompensationRow,
  Database,
  Json,
  ShiftRow,
} from "./database.types";
export type * from "./contracts";

function environment(): PublicEnvironment {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
export function getConfigurationError(
  env: PublicEnvironment = environment(),
): string | null {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
    return "כדי להתחיל, יש להגדיר את VITE_SUPABASE_URL ואת VITE_SUPABASE_PUBLISHABLE_KEY בקובץ ‎.env.local ולהפעיל מחדש את השרת.";
  try {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      return "כתובת Supabase חייבת להשתמש ב־HTTPS (למעט פיתוח מקומי).";
  } catch {
    return "כתובת Supabase אינה תקינה. יש לבדוק את VITE_SUPABASE_URL.";
  }
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_"))
    return "יש להשתמש במפתח Supabase מסוג Publishable בלבד (המתחיל ב־sb_publishable_). אין להזין מפתח סודי.";
  return null;
}
function session(value: Session | null): AuthSession | null {
  return value
    ? { user: { id: value.user.id, email: value.user.email ?? "" } }
    : null;
}
function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  const messages: Record<string, string> = {
    "Invalid login credentials": "האימייל או הסיסמה אינם נכונים.",
    "Email not confirmed": "יש לאמת את כתובת האימייל לפני ההתחברות.",
    "User already registered": "כבר קיים חשבון עם כתובת האימייל הזו.",
    "New password should be different from the old password.":
      "יש לבחור סיסמה שונה מהסיסמה הנוכחית.",
    PACKTRACK_OVERLAP: "המשמרת חופפת למשמרת שכבר נשמרה. יש לבדוק את השעות.",
    PACKTRACK_CONFLICT:
      "המשמרת השתנתה בחלון אחר. יש לרענן את הנתונים ולנסות שוב.",
    PACKTRACK_NOT_FOUND: "המשמרת לא נמצאה או שאין לך הרשאה לצפות בה.",
    PACKTRACK_MISSING_RATES:
      "חסרים תעריפים למשמרת הזו. יש לעדכן את הגדרות השכר.",
    PACKTRACK_INVALID_INPUT:
      "אחד הנתונים אינו תקין. יש לבדוק את התאריך, השעות והתעריפים.",
    PACKTRACK_AUTH_REQUIRED: "יש להתחבר שוב כדי להמשיך.",
  };
  if (
    error.code &&
    [
      "flow_state_not_found",
      "flow_state_expired",
      "bad_code_verifier",
      "pkce_verifier_not_found",
      "otp_expired",
    ].includes(error.code)
  )
    throw new Error(
      "קישור האימות פג או נפתח בדפדפן אחר. יש לפתוח אותו באותו דפדפן שבו התחלת, או לבקש קישור חדש ממסך הכניסה.",
    );
  if (messages[error.message]) throw new Error(messages[error.message]);
  if (
    error.code === "reauthentication_needed" ||
    error.code === "reauthentication_not_valid"
  )
    throw new Error(
      "נדרש אימות נוסף לשינוי הסיסמה. יש לבקש קוד אימות, להזין את הקוד שנשלח לאימייל ולנסות שוב.",
    );
  if (error.code === "PGRST202" || error.code === "42P01")
    throw new Error(
      "מסד הנתונים טרם הוגדר. יש להריץ את המיגרציות לפי הוראות ההתקנה.",
    );
  throw new Error(
    messages[error.message] ??
      "לא ניתן להשלים את הפעולה. יש לבדוק את החיבור ואת הגדרות החשבון ולנסות שוב.",
  );
}
function toCompensation(row: CompensationRow): Compensation {
  return {
    ...(row.rates as unknown as Rates),
    id: row.id,
    effectiveFrom: row.effective_from,
  };
}
const jerusalemDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const jerusalemTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function toShift(row: ShiftRow, bonuses: BonusRow[]): Shift {
  return {
    id: row.id,
    workDate: row.work_date,
    startTime: jerusalemTime.format(new Date(row.start_at)),
    endTime: jerusalemTime.format(new Date(row.end_at)),
    endNextDay: jerusalemDate.format(new Date(row.end_at)) !== row.work_date,
    timeDisambiguation:
      row.time_disambiguation as ShiftDraft["timeDisambiguation"],
    breakMinutes: row.break_minutes,
    counts: row.counts as unknown as Shift["counts"],
    bonuses: bonuses
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ id: b.id, amount: b.amount, description: b.description })),
    notes: row.notes,
    startAt: row.start_at,
    endAt: row.end_at,
    snapshot: row.rates_snapshot as unknown as Rates,
    version: row.version,
    createdAt: row.created_at,
  };
}
export function createServices(
  env: PublicEnvironment = environment(),
): AppServices {
  const configError = getConfigurationError(env);
  if (configError) throw new Error(configError);
  const client = createClient<Database>(
    env.VITE_SUPABASE_URL!,
    env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );
  const redirectTo = () => `${window.location.origin}/auth/callback`;
  return {
    auth: {
      async getSession() {
        const { data, error } = await client.auth.getSession();
        fail(error);
        return session(data.session);
      },
      onAuthStateChange(callback) {
        const { data } = client.auth.onAuthStateChange((event, current) =>
          callback(event, session(current)),
        );
        return () => data.subscription.unsubscribe();
      },
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        fail(error);
      },
      async signUp(email, password, role, hourlyRate = null) {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo(),
            data: { packer_role: role, hourly_rate: hourlyRate },
          },
        });
        fail(error);
        return { needsEmailVerification: !data.session };
      },
      async signOut() {
        const { error } = await client.auth.signOut({ scope: "local" });
        fail(error);
      },
      async resetPassword(email) {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/auth/reset` },
        );
        fail(error);
      },
      async updatePassword(password, nonce) {
        const { error } = await client.auth.updateUser({
          password,
          ...(nonce ? { nonce } : {}),
        });
        fail(error);
      },
      async reauthenticate() {
        const { error } = await client.auth.reauthenticate();
        fail(error);
      },
      async updateEmail(email) {
        const { error } = await client.auth.updateUser(
          { email: email.trim() },
          { emailRedirectTo: redirectTo() },
        );
        fail(error);
      },
      async resendVerification(email) {
        const { error } = await client.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: redirectTo() },
        });
        fail(error);
      },
    },
    repository: {
      async getProfile() {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .single();
        fail(error);
        if (!data) throw new Error("הפרופיל לא נמצא.");
        return { id: data.id, createdAt: data.created_at };
      },
      async getShift(id) {
        const { data, error } = await client
          .from("shifts")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        fail(error);
        if (!data) return null;
        const { data: bonuses, error: bonusError } = await client
          .from("shift_bonuses")
          .select("*")
          .eq("shift_id", id)
          .order("position");
        fail(bonusError);
        return toShift(data, bonuses ?? []);
      },
      async getShifts(fromDate, toDate) {
        let query = client
          .from("shifts")
          .select("*")
          .order("work_date", { ascending: false })
          .order("start_at", { ascending: false });
        if (fromDate) query = query.gte("work_date", fromDate);
        if (toDate) query = query.lt("work_date", toDate);
        // Explicit pages avoid silently truncating a year at the PostgREST row cap.
        const rows: ShiftRow[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await query.range(offset, offset + 499);
          fail(error);
          rows.push(...(data ?? []));
          if (!data || data.length < 500) break;
        }
        const bonuses: BonusRow[] = [];
        for (let offset = 0; offset < rows.length; offset += 100) {
          const ids = rows.slice(offset, offset + 100).map((row) => row.id);
          for (let page = 0; ; page += 500) {
            const { data, error } = await client
              .from("shift_bonuses")
              .select("*")
              .in("shift_id", ids)
              .order("id")
              .range(page, page + 499);
            fail(error);
            bonuses.push(...(data ?? []));
            if (!data || data.length < 500) break;
          }
        }
        return rows.map((row) =>
          toShift(
            row,
            bonuses.filter((b) => b.shift_id === row.id),
          ),
        );
      },
      async getCompensationSettings() {
        const { data, error } = await client
          .from("compensation_history")
          .select("*")
          .order("effective_from");
        fail(error);
        return (data ?? []).map(toCompensation);
      },
      async updateCompensationSettings(config) {
        const { effectiveFrom } = config;
        const rates = ratesSchema.parse(config);
        const { data, error } = await client.rpc("set_compensation", {
          p_effective_from: effectiveFrom,
          p_rates: rates as unknown as Json,
        });
        fail(error);
        if (!data) throw new Error("לא ניתן לשמור את התעריפים.");
        return toCompensation(data);
      },
      async saveShift(draft, expectedVersion = 0, override) {
        const { startAt, endAt } = resolveShiftTimes(draft);
        const payload = {
          ...draft,
          startAt,
          endAt,
          bonuses: draft.bonuses.map(({ amount, description }) => ({
            amount,
            description,
          })),
        };
        const { data, error } = await client.rpc("save_shift", {
          p_shift: payload as unknown as Json,
          p_expected_version: expectedVersion,
          ...(override
            ? { p_override: ratesSchema.parse(override) as unknown as Json }
            : {}),
        });
        fail(error);
        if (!data) throw new Error("לא ניתן לשמור את המשמרת.");
        const result = data as unknown as {
          shift: ShiftRow;
          bonuses: BonusRow[];
        };
        return toShift(result.shift, result.bonuses);
      },
      async deleteShift(id, version) {
        const { error } = await client.rpc("delete_shift", {
          p_id: id,
          p_expected_version: version,
        });
        fail(error);
      },
    },
  };
}
