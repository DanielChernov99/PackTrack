import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";

export const TIME_ZONE = "Asia/Jerusalem";
export const roleLabels = {
  regular: "מקפל רגיל",
  review: "מקפל על ביקורות",
  checker: "צ׳קר / בודק שלבים",
} as const;

export type Role = keyof typeof roleLabels;
export interface Rates {
  role: Role;
  hourlyRate: number | null;
  hourlyAdjustment: number;
  creditedMinutes: number;
  studentRate: number | null;
  sigmaRate: number | null;
  privateSharedRate: number | null;
  privateSoloRate: number | null;
}
export interface Compensation extends Rates {
  id: string;
  effectiveFrom: string;
}
export interface Counts {
  student: number;
  sigma: number;
  privateShared: number;
  privateSolo: number;
}
export interface Bonus {
  id?: string;
  amount: number;
  description: string;
}
export interface ShiftDraft {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  endNextDay: boolean;
  timeDisambiguation: "reject" | "earlier" | "later";
  breakMinutes: number;
  counts: Counts;
  bonuses: Bonus[];
  notes: string;
}
export interface Shift extends ShiftDraft {
  startAt: string;
  endAt: string;
  snapshot: Rates;
  version: number;
  createdAt: string;
}
export interface ShiftTimes {
  startAt: string;
  endAt: string;
  workedMinutes: number;
  /** Actual elapsed minutes after unpaid breaks, excluding additional credited time. */
  paidMinutes: number;
}
export interface Earnings {
  paidMinutes: number;
  creditedMinutes: number;
  hourly: number;
  pieces: number;
  bonuses: number;
  total: number;
  count: number;
  breakdown: Counts;
}
export interface Summary extends Earnings {
  shifts: number;
  workedMinutes: number;
  /** Summary paidMinutes includes credited time; subtract creditedMinutes for actual paid work. */
  paidMinutes: number;
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

const integer = (min: number, max: number, label: string) =>
  z
    .number()
    .int(`${label}: יש להזין מספר שלם`)
    .min(min, `${label}: הערך נמוך מדי`)
    .max(max, `${label}: הערך גבוה מדי`);
const rate = integer(0, 1_000_000, "תעריף").nullable();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין")
  .refine((value) => {
    try {
      Temporal.PlainDate.from(value);
      return true;
    } catch {
      return false;
    }
  }, "תאריך לא תקין");
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "שעה לא תקינה");

export const ratesSchema = z
  .object({
    role: z.enum(["regular", "review", "checker"]),
    hourlyRate: rate,
    hourlyAdjustment: integer(-1_000_000, 1_000_000, "תוספת שעתית"),
    creditedMinutes: integer(0, 1440, "זמן מזוכה נוסף"),
    studentRate: rate,
    sigmaRate: rate,
    privateSharedRate: rate,
    privateSoloRate: rate,
  })
  .refine(
    (value) =>
      value.hourlyRate === null ||
      value.hourlyRate + value.hourlyAdjustment >= 0,
    {
      message: "השכר לשעה לאחר ההתאמה לא יכול להיות שלילי",
      path: ["hourlyAdjustment"],
    },
  );

export const shiftDraftSchema = z.object({
  id: z.string().uuid("מזהה המשמרת לא תקין"),
  workDate: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  endNextDay: z.boolean(),
  timeDisambiguation: z.enum(["reject", "earlier", "later"]),
  breakMinutes: integer(0, 1439, "הפסקה"),
  counts: z.object({
    student: integer(0, 10_000, "חניך"),
    sigma: integer(0, 10_000, "סיגמה"),
    privateShared: integer(0, 10_000, "פרטי בזוג"),
    privateSolo: integer(0, 10_000, "פרטי לבד"),
  }),
  bonuses: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        amount: integer(-10_000_000, 10_000_000, "בונוס או התאמה"),
        description: z.string().max(200, "תיאור ההתאמה מוגבל ל־200 תווים"),
      }),
    )
    .max(50, "ניתן להוסיף עד 50 בונוסים למשמרת"),
  notes: z.string().max(2000, "ההערות מוגבלות ל־2,000 תווים"),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new DomainError(
      result.error.issues[0]?.message ?? "נתונים לא תקינים",
    );
  return result.data;
}

/** Only known club rates are prefilled. Null means configuration is required. */
export function defaultRates(role: Role): Rates {
  return {
    role,
    hourlyRate: null,
    hourlyAdjustment: 0,
    creditedMinutes: 0,
    studentRate: role === "regular" ? 1100 : null,
    sigmaRate: role === "regular" ? 1100 : null,
    privateSharedRate: role === "regular" ? 900 : null,
    privateSoloRate: null,
  };
}

export function todayInJerusalem(): string {
  return Temporal.Now.plainDateISO(TIME_ZONE).toString();
}
export function monthInJerusalem(date: Date = new Date()): string {
  return Temporal.Instant.from(date.toISOString())
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDate()
    .toString()
    .slice(0, 7);
}

function localTime(
  date: Temporal.PlainDate,
  time: string,
  disambiguation: ShiftDraft["timeDisambiguation"],
) {
  const local = date.toPlainDateTime(Temporal.PlainTime.from(time));
  try {
    const zoned = local.toZonedDateTime(TIME_ZONE, { disambiguation });
    // Temporal can move nonexistent spring-forward times. A work log must never silently do so.
    if (!zoned.toPlainDateTime().equals(local))
      throw new DomainError(
        "השעה שבחרת אינה קיימת ביום המעבר לשעון קיץ. יש לבחור שעה אחרת",
      );
    return zoned;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "השעה אינה קיימת או מופיעה פעמיים בגלל שינוי שעון. יש לבחור שעה אחרת או לבחור במפורש את המופע הראשון / השני",
    );
  }
}

function validateDuration(workedMinutes: number, breakMinutes: number): number {
  if (
    !Number.isFinite(workedMinutes) ||
    !Number.isInteger(workedMinutes) ||
    workedMinutes <= 0 ||
    workedMinutes > 1440
  ) {
    throw new DomainError(
      "משך המשמרת חייב להיות גדול מאפס ועד 24 שעות בפועל. למשמרת לילה יש לבחור סיום ביום הבא",
    );
  }
  if (breakMinutes >= workedMinutes)
    throw new DomainError("משך ההפסקה חייב להיות קצר ממשך המשמרת");
  return workedMinutes - breakMinutes;
}

/** Convert wall-clock inputs to unambiguous instants; duration is actual elapsed time across DST. */
export function resolveShiftTimes(input: ShiftDraft): ShiftTimes {
  const draft = parse(shiftDraftSchema, input);
  const date = Temporal.PlainDate.from(draft.workDate);
  const start = localTime(date, draft.startTime, draft.timeDisambiguation);
  const end = localTime(
    draft.endNextDay ? date.add({ days: 1 }) : date,
    draft.endTime,
    draft.timeDisambiguation,
  );
  const workedMinutes =
    (end.epochMilliseconds - start.epochMilliseconds) / 60_000;
  const paidMinutes = validateDuration(workedMinutes, draft.breakMinutes);
  return {
    startAt: start.toInstant().toString(),
    endAt: end.toInstant().toString(),
    workedMinutes,
    paidMinutes,
  };
}

export function selectCompensation(
  history: readonly Compensation[],
  date: string,
): Compensation | null {
  parse(dateSchema, date);
  // Copy/sort so rendering or selecting a backdated shift never mutates application state.
  const applicable = history
    .filter((item) => item.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return applicable[0] ?? null;
}

const categories = [
  "student",
  "sigma",
  "privateShared",
  "privateSolo",
] as const;
const categoryRates = {
  student: "studentRate",
  sigma: "sigmaRate",
  privateShared: "privateSharedRate",
  privateSolo: "privateSoloRate",
} as const;
const categoryLabels = {
  student: "חניך",
  sigma: "סיגמה",
  privateShared: "פרטי בזוג",
  privateSolo: "פרטי לבד",
} as const;

function earnings(
  draft: ShiftDraft,
  rawRates: Rates,
  paidMinutes: number,
): Earnings {
  const rates = parse(ratesSchema, rawRates);
  if (rates.hourlyRate === null)
    throw new DomainError(
      "חסר תעריף שעתי לתאריך המשמרת. יש להשלים אותו בהגדרות השכר",
    );
  const breakdown: Counts = {
    student: 0,
    sigma: 0,
    privateShared: 0,
    privateSolo: 0,
  };
  for (const category of categories) {
    const pieceRate = rates[categoryRates[category]];
    if (draft.counts[category] > 0 && pieceRate === null) {
      throw new DomainError(
        `חסר תעריף למצנח ${categoryLabels[category]}. יש להשלים אותו בהגדרות השכר`,
      );
    }
    breakdown[category] = draft.counts[category] * (pieceRate ?? 0);
  }
  // Round once per hourly subtotal to the nearest agora, matching PostgreSQL round(numeric).
  const hourly = Math.round(
    ((rates.hourlyRate + rates.hourlyAdjustment) *
      (paidMinutes + rates.creditedMinutes)) /
      60,
  );
  const pieces = categories.reduce(
    (sum, category) => sum + breakdown[category],
    0,
  );
  const bonuses = draft.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);
  return {
    paidMinutes,
    creditedMinutes: rates.creditedMinutes,
    hourly,
    pieces,
    bonuses,
    total: hourly + pieces + bonuses,
    count: categories.reduce(
      (sum, category) => sum + draft.counts[category],
      0,
    ),
    breakdown,
  };
}

export function calculateEarnings(draft: ShiftDraft, rates: Rates): Earnings {
  const validDraft = parse(shiftDraftSchema, draft);
  return earnings(validDraft, rates, resolveShiftTimes(validDraft).paidMinutes);
}

/** Saved shifts use their persisted UTC instants and immutable compensation snapshot. */
export function earningsForShift(shift: Shift): Earnings {
  const draft = parse(shiftDraftSchema, shift);
  let minutes: number;
  try {
    minutes =
      (Temporal.Instant.from(shift.endAt).epochMilliseconds -
        Temporal.Instant.from(shift.startAt).epochMilliseconds) /
      60_000;
  } catch {
    throw new DomainError("זמני המשמרת השמורה אינם תקינים");
  }
  return earnings(
    draft,
    shift.snapshot,
    validateDuration(minutes, draft.breakMinutes),
  );
}

export function summarizeShifts(shifts: readonly Shift[]): Summary {
  return shifts.reduce<Summary>(
    (sum, shift) => {
      const row = earningsForShift(shift);
      return {
        shifts: sum.shifts + 1,
        workedMinutes: sum.workedMinutes + row.paidMinutes + shift.breakMinutes,
        paidMinutes: sum.paidMinutes + row.paidMinutes + row.creditedMinutes,
        creditedMinutes: sum.creditedMinutes + row.creditedMinutes,
        hourly: sum.hourly + row.hourly,
        pieces: sum.pieces + row.pieces,
        bonuses: sum.bonuses + row.bonuses,
        total: sum.total + row.total,
        count: sum.count + row.count,
        breakdown: {
          student: sum.breakdown.student + row.breakdown.student,
          sigma: sum.breakdown.sigma + row.breakdown.sigma,
          privateShared:
            sum.breakdown.privateShared + row.breakdown.privateShared,
          privateSolo: sum.breakdown.privateSolo + row.breakdown.privateSolo,
        },
      };
    },
    {
      shifts: 0,
      workedMinutes: 0,
      paidMinutes: 0,
      creditedMinutes: 0,
      hourly: 0,
      pieces: 0,
      bonuses: 0,
      total: 0,
      count: 0,
      breakdown: { student: 0, sigma: 0, privateShared: 0, privateSolo: 0 },
    },
  );
}

export function toDraft(shift: Shift): ShiftDraft {
  return parse(shiftDraftSchema, shift);
}

export function money(agorot: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(agorot / 100);
}

/** Decimal shekels -> integer agorot without binary floating point rounding drift. */
export function decimalToAgorot(value: string | number): number {
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text))
    throw new DomainError("יש להזין סכום עם עד שתי ספרות אחרי הנקודה");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new DomainError("הסכום גדול מדי");
  return negative ? -result : result;
}

export function shiftsOverlap(
  first: Pick<Shift, "startAt" | "endAt">,
  second: Pick<Shift, "startAt" | "endAt">,
): boolean {
  return (
    Temporal.Instant.compare(first.startAt, second.endAt) < 0 &&
    Temporal.Instant.compare(second.startAt, first.endAt) < 0
  );
}
