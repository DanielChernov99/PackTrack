import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServices, getConfigurationError } from "./index";
import { defaultRates, type Compensation, type ShiftDraft } from "../domain";

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: mocked.rpc })),
}));
const configured = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
};
beforeEach(() => mocked.rpc.mockReset());

describe("public backend configuration", () => {
  it("reports missing configuration and refuses to create a fake backend", () => {
    expect(getConfigurationError({})).toContain("VITE_SUPABASE_URL");
    expect(() => createServices({})).toThrow();
  });
  it("accepts HTTPS and local development only", () => {
    expect(getConfigurationError(configured)).toBeNull();
    expect(
      getConfigurationError({
        ...configured,
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toBeNull();
    expect(
      getConfigurationError({
        ...configured,
        VITE_SUPABASE_URL: "http://remote.example.com",
      }),
    ).not.toBeNull();
  });
  it("rejects secret and legacy keys before constructing the browser client", () => {
    expect(
      getConfigurationError({
        ...configured,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_not_a_real_key",
      }),
    ).not.toBeNull();
    expect(
      getConfigurationError({
        ...configured,
        VITE_SUPABASE_PUBLISHABLE_KEY: "eyJ_legacy_example",
      }),
    ).not.toBeNull();
  });
});

describe("repository serialization", () => {
  it("strips compensation identity and date from the strict database rate object", async () => {
    const config: Compensation = {
      ...defaultRates("regular"),
      hourlyRate: 3500,
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      effectiveFrom: "2026-11-01",
    };
    mocked.rpc.mockResolvedValue({
      data: {
        id: config.id,
        effective_from: config.effectiveFrom,
        rates: { ...defaultRates("regular"), hourlyRate: 3500 },
      },
      error: null,
    });
    await createServices(configured).repository.updateCompensationSettings(
      config,
    );
    const [, payload] = mocked.rpc.mock.calls[0];
    expect(payload.p_rates).not.toHaveProperty("id");
    expect(payload.p_rates).not.toHaveProperty("effectiveFrom");
    expect(Object.keys(payload.p_rates)).toHaveLength(8);
    expect(payload.p_rates.hourlyRate).toBe(3500);
  });
  it("serializes explicit override rates without stale history metadata", async () => {
    const draft: ShiftDraft = {
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      workDate: "2026-11-01",
      startTime: "09:00",
      endTime: "17:00",
      endNextDay: false,
      timeDisambiguation: "reject",
      breakMinutes: 0,
      counts: { student: 0, sigma: 0, privateShared: 0, privateSolo: 0 },
      bonuses: [],
      notes: "",
    };
    const override: Compensation = {
      ...defaultRates("regular"),
      hourlyRate: 3500,
      id: draft.id,
      effectiveFrom: draft.workDate,
    };
    mocked.rpc.mockResolvedValue({
      data: null,
      error: { message: "PACKTRACK_CONFLICT" },
    });
    await expect(
      createServices(configured).repository.saveShift(draft, 2, override),
    ).rejects.toThrow("חלון אחר");
    const [, payload] = mocked.rpc.mock.calls[0];
    expect(payload.p_override).not.toHaveProperty("id");
    expect(payload.p_expected_version).toBe(2);
    expect(payload.p_shift.startAt).toBe("2026-11-01T07:00:00Z");
  });
});
