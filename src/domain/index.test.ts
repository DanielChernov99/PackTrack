import { describe, expect, it } from "vitest";
import {
  calculateEarnings,
  decimalToAgorot,
  defaultRates,
  earningsForShift,
  monthInJerusalem,
  resolveShiftTimes,
  selectCompensation,
  shiftsOverlap,
  summarizeShifts,
  toDraft,
  type Compensation,
  type Rates,
  type Shift,
  type ShiftDraft,
} from "./index";

const id = "00000000-0000-4000-8000-000000000001";
const draft = (overrides: Partial<ShiftDraft> = {}): ShiftDraft => ({
  id,
  workDate: "2026-11-09",
  startTime: "08:00",
  endTime: "16:00",
  endNextDay: false,
  timeDisambiguation: "reject",
  breakMinutes: 0,
  counts: { student: 0, sigma: 0, privateShared: 0, privateSolo: 0 },
  bonuses: [],
  notes: "",
  ...overrides,
});
const rates = (overrides: Partial<Rates> = {}): Rates => ({
  ...defaultRates("regular"),
  hourlyRate: 4000,
  ...overrides,
});
const saved = (
  input: ShiftDraft = draft(),
  snapshot: Rates = rates(),
): Shift => ({
  ...input,
  ...resolveShiftTimes(input),
  snapshot,
  version: 1,
  createdAt: "2026-11-09T12:00:00Z",
});
const history: Compensation[] = [
  { ...rates(), id: "oct", effectiveFrom: "2026-10-01" },
  {
    ...rates({ role: "checker", hourlyRate: 5000, studentRate: 1500 }),
    id: "nov",
    effectiveFrom: "2026-11-01",
  },
];

describe("earnings in integer agorot", () => {
  it("pays hourly compensation", () => {
    expect(calculateEarnings(draft(), rates())).toMatchObject({
      paidMinutes: 480,
      hourly: 32_000,
      total: 32_000,
    });
  });
  it("calculates mixed piece rates without replacing unknown rates", () => {
    const result = calculateEarnings(
      draft({
        counts: { student: 4, sigma: 2, privateShared: 3, privateSolo: 1 },
      }),
      rates({ privateSoloRate: 1800 }),
    );
    expect(result).toMatchObject({
      count: 10,
      pieces: 11_100,
      total: 43_100,
      breakdown: {
        student: 4400,
        sigma: 2200,
        privateShared: 2700,
        privateSolo: 1800,
      },
    });
  });
  it("sums multiple bonuses and negative manual corrections", () => {
    const result = calculateEarnings(
      draft({
        bonuses: [
          { amount: 5000, description: "בונוס" },
          { amount: -1250, description: "תיקון שכר" },
        ],
      }),
      rates(),
    );
    expect(result.bonuses).toBe(3750);
    expect(result.total).toBe(35_750);
  });
  it("subtracts unpaid breaks before applying wages", () => {
    expect(
      calculateEarnings(draft({ breakMinutes: 30 }), rates()),
    ).toMatchObject({ paidMinutes: 450, hourly: 30_000 });
  });
  it("supports explicit hourly and credited-time adjustments independently", () => {
    const result = calculateEarnings(
      draft({ breakMinutes: 30 }),
      rates({ hourlyAdjustment: 500, creditedMinutes: 30 }),
    );
    expect(result).toMatchObject({
      paidMinutes: 450,
      creditedMinutes: 30,
      hourly: 36_000,
    });
  });
  it("supports a negative hourly adjustment without allowing a negative hourly rate", () => {
    expect(
      calculateEarnings(draft(), rates({ hourlyAdjustment: -500 })).hourly,
    ).toBe(28_000);
    expect(() =>
      calculateEarnings(draft(), rates({ hourlyAdjustment: -4001 })),
    ).toThrow("שלילי");
  });
  it("rounds the hourly subtotal once to the nearest agora", () => {
    expect(
      calculateEarnings(
        draft({ endTime: "08:01" }),
        rates({ hourlyRate: 4001 }),
      ).hourly,
    ).toBe(67);
    expect(
      calculateEarnings(draft({ endTime: "08:01" }), rates({ hourlyRate: 30 }))
        .hourly,
    ).toBe(1);
  });
  it("requires the hourly rate even when no parachutes were packed", () => {
    expect(() => calculateEarnings(draft(), defaultRates("regular"))).toThrow(
      "שעתי",
    );
  });
  it("requires only piece rates actually used by the shift", () => {
    expect(() => calculateEarnings(draft(), rates())).not.toThrow();
    expect(() =>
      calculateEarnings(
        draft({
          counts: { student: 0, sigma: 0, privateShared: 0, privateSolo: 1 },
        }),
        rates(),
      ),
    ).toThrow("פרטי לבד");
  });
  it("accepts an explicitly configured zero rate", () => {
    expect(
      calculateEarnings(
        draft({
          counts: { student: 2, sigma: 0, privateShared: 0, privateSolo: 0 },
        }),
        rates({ hourlyRate: 0, studentRate: 0 }),
      ).total,
    ).toBe(0);
  });
  it("never substitutes regular defaults for checker or review roles", () => {
    for (const role of ["checker", "review"] as const) {
      expect(defaultRates(role)).toMatchObject({
        role,
        hourlyRate: null,
        studentRate: null,
        sigmaRate: null,
        privateSharedRate: null,
        privateSoloRate: null,
      });
    }
  });
  it("keeps known regular rates and leaves unknown wages unconfigured", () => {
    expect(defaultRates("regular")).toMatchObject({
      hourlyRate: null,
      studentRate: 1100,
      sigmaRate: 1100,
      privateSharedRate: 900,
      privateSoloRate: null,
    });
  });
});

describe("Jerusalem wall-clock time and daylight saving", () => {
  it("resolves local time to UTC", () => {
    expect(resolveShiftTimes(draft())).toMatchObject({
      startAt: "2026-11-09T06:00:00Z",
      endAt: "2026-11-09T14:00:00Z",
      workedMinutes: 480,
    });
  });
  it("supports overnight shifts when the next day is explicit", () => {
    expect(
      resolveShiftTimes(
        draft({ startTime: "22:00", endTime: "06:00", endNextDay: true }),
      ),
    ).toMatchObject({ workedMinutes: 480, endAt: "2026-11-10T04:00:00Z" });
    expect(() =>
      resolveShiftTimes(draft({ startTime: "22:00", endTime: "06:00" })),
    ).toThrow("יום הבא");
  });
  it("counts real elapsed time on the spring transition", () => {
    expect(
      resolveShiftTimes(
        draft({ workDate: "2026-03-27", startTime: "01:30", endTime: "03:30" }),
      ).workedMinutes,
    ).toBe(60);
  });
  it("counts real elapsed time on the autumn transition", () => {
    expect(
      resolveShiftTimes(
        draft({ workDate: "2026-10-25", startTime: "00:30", endTime: "02:30" }),
      ).workedMinutes,
    ).toBe(180);
  });
  it("rejects nonexistent spring times even with an explicit disambiguation choice", () => {
    for (const timeDisambiguation of ["reject", "earlier", "later"] as const) {
      expect(() =>
        resolveShiftTimes(
          draft({
            workDate: "2026-03-27",
            startTime: "02:15",
            endTime: "04:00",
            timeDisambiguation,
          }),
        ),
      ).toThrow();
    }
  });
  it("requires an explicit choice for repeated autumn clock times", () => {
    const input = draft({
      workDate: "2026-10-25",
      startTime: "01:30",
      endTime: "03:00",
    });
    expect(() => resolveShiftTimes(input)).toThrow("פעמיים");
    const first = resolveShiftTimes({
      ...input,
      timeDisambiguation: "earlier",
    });
    const second = resolveShiftTimes({ ...input, timeDisambiguation: "later" });
    expect(first.workedMinutes - second.workedMinutes).toBe(60);
  });
  it("rejects zero-length and longer-than-24-hour shifts", () => {
    expect(() => resolveShiftTimes(draft({ endTime: "08:00" }))).toThrow();
    expect(() =>
      resolveShiftTimes(draft({ endTime: "09:00", endNextDay: true })),
    ).toThrow();
    expect(
      resolveShiftTimes(draft({ endTime: "08:00", endNextDay: true }))
        .workedMinutes,
    ).toBe(1440);
  });
  it("checks 24-hour limit in actual elapsed time on autumn fallback", () => {
    expect(() =>
      resolveShiftTimes(
        draft({
          workDate: "2026-10-24",
          startTime: "08:00",
          endTime: "08:00",
          endNextDay: true,
        }),
      ),
    ).toThrow();
  });
  it("rejects invalid dates and malformed times", () => {
    expect(() =>
      resolveShiftTimes(draft({ workDate: "2026-02-30" })),
    ).toThrow();
    expect(() => resolveShiftTimes(draft({ startTime: "24:00" }))).toThrow();
    expect(() => resolveShiftTimes(draft({ startTime: "08:60" }))).toThrow();
  });
  it("uses Jerusalem month boundaries instead of UTC month boundaries", () => {
    expect(monthInJerusalem(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11");
    expect(monthInJerusalem(new Date("2026-10-31T21:30:00Z"))).toBe("2026-10");
    expect(monthInJerusalem(new Date("2026-06-30T21:30:00Z"))).toBe("2026-07");
  });
});

describe("historical roles, effective dates, and editing", () => {
  it("selects the last effective configuration for backdated shifts", () => {
    expect(selectCompensation(history, "2026-10-15")?.role).toBe("regular");
    expect(selectCompensation(history, "2026-11-01")?.role).toBe("checker");
    expect(selectCompensation(history, "2026-12-01")?.hourlyRate).toBe(5000);
    expect(selectCompensation(history, "2026-09-30")).toBeNull();
  });
  it("does not depend on history input order or mutate it", () => {
    const reversed = [...history].reverse();
    expect(selectCompensation(reversed, "2026-10-20")?.id).toBe("oct");
    expect(reversed[0]?.id).toBe("nov");
  });
  it("editing quantities keeps the old snapshot despite a promotion", () => {
    const old = saved(
      draft({
        workDate: "2026-10-15",
        counts: { student: 1, sigma: 0, privateShared: 0, privateSolo: 0 },
      }),
      history[0],
    );
    const edited = {
      ...toDraft(old),
      counts: { student: 2, sigma: 0, privateShared: 0, privateSolo: 0 },
    };
    expect(calculateEarnings(edited, old.snapshot)).toMatchObject({
      hourly: 32_000,
      pieces: 2200,
      total: 34_200,
    });
    // An intentional override is a distinct call with explicitly supplied replacement rates.
    expect(calculateEarnings(edited, history[1])).toMatchObject({
      hourly: 40_000,
      pieces: 3000,
      total: 43_000,
    });
  });
  it("moving an old shift to another month retains its compensation snapshot", () => {
    const old = saved(draft({ workDate: "2026-10-15" }), history[0]);
    expect(
      calculateEarnings(
        { ...toDraft(old), workDate: "2026-11-15" },
        old.snapshot,
      ).total,
    ).toBe(32_000);
  });
  it("persisted UTC instants are authoritative when summarizing saved earnings", () => {
    const shift = saved();
    expect(
      earningsForShift({ ...shift, endAt: "2026-11-09T15:00:00Z" }).hourly,
    ).toBe(36_000);
  });
  it("removes persisted-only fields when entering edit mode", () => {
    const value = toDraft(saved());
    expect(value).not.toHaveProperty("snapshot");
    expect(value).not.toHaveProperty("startAt");
    expect(value).not.toHaveProperty("version");
  });
});

describe("monthly aggregation and overlap", () => {
  it("aggregates saved snapshots, bonuses, counts, and payable time", () => {
    const first = saved(
      draft({
        breakMinutes: 30,
        counts: { student: 2, sigma: 0, privateShared: 0, privateSolo: 0 },
        bonuses: [{ amount: 1000, description: "" }],
      }),
      rates({ creditedMinutes: 30 }),
    );
    const second = saved(
      draft({
        workDate: "2026-11-10",
        endTime: "12:00",
        counts: { student: 0, sigma: 1, privateShared: 1, privateSolo: 0 },
        bonuses: [{ amount: -500, description: "" }],
      }),
      rates({ hourlyRate: 5000 }),
    );
    expect(summarizeShifts([first, second])).toMatchObject({
      shifts: 2,
      workedMinutes: 720,
      paidMinutes: 720,
      creditedMinutes: 30,
      hourly: 52_000,
      pieces: 4200,
      bonuses: 500,
      total: 56_700,
      count: 4,
    });
  });
  it("returns zero aggregates for an empty month", () => {
    expect(summarizeShifts([])).toMatchObject({
      shifts: 0,
      paidMinutes: 0,
      total: 0,
      count: 0,
    });
  });
  it("treats adjacent shifts as non-overlapping and catches overnight intersections", () => {
    const first = resolveShiftTimes(
      draft({ startTime: "22:00", endTime: "06:00", endNextDay: true }),
    );
    const overlap = resolveShiftTimes(
      draft({ workDate: "2026-11-10", startTime: "05:00", endTime: "08:00" }),
    );
    const adjacent = resolveShiftTimes(
      draft({ workDate: "2026-11-10", startTime: "06:00", endTime: "08:00" }),
    );
    expect(shiftsOverlap(first, overlap)).toBe(true);
    expect(shiftsOverlap(first, adjacent)).toBe(false);
  });
});

describe("input and precision validation", () => {
  it.each([-1, 0.5, 10_001, Number.NaN, Infinity])(
    "rejects invalid count %s",
    (student) => {
      expect(() =>
        calculateEarnings(
          draft({
            counts: { student, sigma: 0, privateShared: 0, privateSolo: 0 },
          }),
          rates(),
        ),
      ).toThrow();
    },
  );
  it.each([-1, 0.5, 480, 481])(
    "rejects invalid unpaid break %s",
    (breakMinutes) => {
      expect(() =>
        calculateEarnings(draft({ breakMinutes }), rates()),
      ).toThrow();
    },
  );
  it("rejects malformed or excessive bonuses", () => {
    expect(() =>
      calculateEarnings(
        draft({ bonuses: [{ amount: 1.5, description: "" }] }),
        rates(),
      ),
    ).toThrow();
    expect(() =>
      calculateEarnings(
        draft({ bonuses: [{ amount: 10_000_001, description: "" }] }),
        rates(),
      ),
    ).toThrow();
    expect(() =>
      calculateEarnings(
        draft({
          bonuses: Array.from({ length: 51 }, () => ({
            amount: 0,
            description: "",
          })),
        }),
        rates(),
      ),
    ).toThrow();
  });
  it("converts decimal money without floating-point rounding errors", () => {
    expect(decimalToAgorot("1.01")).toBe(101);
    expect(decimalToAgorot(19.99)).toBe(1999);
    expect(decimalToAgorot("-12.50")).toBe(-1250);
    expect(decimalToAgorot("0")).toBe(0);
    expect(decimalToAgorot("10.1")).toBe(1010);
  });
  it.each(["", "1.001", "1e5", "NaN", "Infinity", "1,200", "9007199254740992"])(
    "rejects ambiguous or unsafe money %s",
    (value) => {
      expect(() => decimalToAgorot(value)).toThrow();
    },
  );
});
