import { vi } from "vitest";
import type { AppContextValue } from "../app/context";
import type { AuthAdapter, PackTrackRepository } from "../data/contracts";
import {
  defaultRates,
  resolveShiftTimes,
  type Compensation,
  type Rates,
  type Shift,
  type ShiftDraft,
} from "../domain";

// Synthetic identities and earnings are confined to test fixtures.
export const fixtureIds = {
  user: "00000000-0000-4000-8000-000000000001",
  shift: "00000000-0000-4000-8000-000000000002",
  compensation: "00000000-0000-4000-8000-000000000003",
};

export function fixtureRates(overrides: Partial<Rates> = {}): Rates {
  return { ...defaultRates("regular"), hourlyRate: 4000, ...overrides };
}

export function fixtureCompensation(
  overrides: Partial<Compensation> = {},
): Compensation {
  return {
    ...fixtureRates(),
    id: fixtureIds.compensation,
    effectiveFrom: "1900-01-01",
    ...overrides,
  };
}

export function fixtureDraft(overrides: Partial<ShiftDraft> = {}): ShiftDraft {
  return {
    id: fixtureIds.shift,
    workDate: "2026-10-10",
    startTime: "08:00",
    endTime: "16:00",
    endNextDay: false,
    timeDisambiguation: "reject",
    breakMinutes: 0,
    counts: { student: 2, sigma: 0, privateShared: 0, privateSolo: 0 },
    bonuses: [],
    notes: "",
    ...overrides,
  };
}

export function fixtureShift(overrides: Partial<Shift> = {}): Shift {
  const draft = fixtureDraft(overrides);
  const { startAt, endAt } = resolveShiftTimes(draft);
  return {
    ...draft,
    startAt,
    endAt,
    snapshot: fixtureRates(),
    version: 3,
    createdAt: "2026-10-10T14:00:00Z",
    ...overrides,
  };
}

export function fixtureContext(
  options: { shift?: Shift; compensations?: Compensation[] } = {},
) {
  const compensations = options.compensations ?? [fixtureCompensation()];
  const repository = {
    getProfile: vi.fn<PackTrackRepository["getProfile"]>().mockResolvedValue({
      id: fixtureIds.user,
      createdAt: "2026-10-01T00:00:00Z",
    }),
    getShifts: vi
      .fn<PackTrackRepository["getShifts"]>()
      .mockResolvedValue(options.shift ? [options.shift] : []),
    getShift: vi
      .fn<PackTrackRepository["getShift"]>()
      .mockResolvedValue(options.shift ?? null),
    getCompensationSettings: vi
      .fn<PackTrackRepository["getCompensationSettings"]>()
      .mockResolvedValue(compensations),
    updateCompensationSettings: vi
      .fn<PackTrackRepository["updateCompensationSettings"]>()
      .mockImplementation(async (config) => ({
        ...config,
        id: fixtureIds.compensation,
      })),
    saveShift: vi
      .fn<PackTrackRepository["saveShift"]>()
      .mockResolvedValue(options.shift ?? fixtureShift()),
    deleteShift: vi
      .fn<PackTrackRepository["deleteShift"]>()
      .mockResolvedValue(undefined),
  } satisfies PackTrackRepository;
  const auth = {
    getSession: vi.fn<AuthAdapter["getSession"]>().mockResolvedValue({
      user: { id: fixtureIds.user, email: "packer@example.test" },
    }),
    onAuthStateChange: vi
      .fn<AuthAdapter["onAuthStateChange"]>()
      .mockReturnValue(() => undefined),
    signIn: vi.fn<AuthAdapter["signIn"]>().mockResolvedValue(undefined),
    signUp: vi
      .fn<AuthAdapter["signUp"]>()
      .mockResolvedValue({ needsEmailVerification: true }),
    signOut: vi.fn<AuthAdapter["signOut"]>().mockResolvedValue(undefined),
    resetPassword: vi
      .fn<AuthAdapter["resetPassword"]>()
      .mockResolvedValue(undefined),
    updatePassword: vi
      .fn<AuthAdapter["updatePassword"]>()
      .mockResolvedValue(undefined),
    reauthenticate: vi
      .fn<AuthAdapter["reauthenticate"]>()
      .mockResolvedValue(undefined),
    updateEmail: vi
      .fn<AuthAdapter["updateEmail"]>()
      .mockResolvedValue(undefined),
    resendVerification: vi
      .fn<AuthAdapter["resendVerification"]>()
      .mockResolvedValue(undefined),
  } satisfies AuthAdapter;
  const context = {
    repository,
    auth,
    user: { id: fixtureIds.user, email: "packer@example.test" },
    compensations,
    refreshCompensations: vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
  } satisfies AppContextValue;
  return context;
}
