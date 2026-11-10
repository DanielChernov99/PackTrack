import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectionProvider, MantineProvider } from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppContext } from "../app/context";
import { money } from "../domain";
import {
  fixtureCompensation,
  fixtureContext,
  fixtureRates,
  fixtureShift,
} from "../test/fixtures";
import { SettingsPage } from "./SettingsPage";
import { ShiftEditor } from "./ShiftEditor";

afterEach(() => {
  cleanup();
  notifications.clean();
});
beforeEach(() => {
  // A browser capability stub, rather than a mock reset between tests.
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });
  Element.prototype.scrollIntoView = () => undefined;
});

const currencyText = (agorot: number) =>
  screen.getByText(money(agorot), { normalizer: (text) => text });

function renderForm(context = fixtureContext(), path = "/shifts/new") {
  render(
    <DirectionProvider initialDirection="rtl">
      <MantineProvider defaultColorScheme="light" env="test">
        <Notifications />
        <AppContext.Provider value={context}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/shifts/new" element={<ShiftEditor />} />
              <Route path="/shifts/:id" element={<ShiftEditor />} />
              <Route path="/shifts" element={<p>רשימת המשמרות נשמרה</p>} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </MemoryRouter>
        </AppContext.Provider>
      </MantineProvider>
    </DirectionProvider>,
  );
  return { context, user: userEvent.setup() };
}

describe("shift forms with real domain calculations", () => {
  it("creates a shift with a break and piece work, then returns to history after persistence", async () => {
    const { context, user } = renderForm();
    fireEvent.change(screen.getByLabelText(/תאריך המשמרת/), {
      target: { value: "2026-11-09" },
    });
    await user.click(screen.getByRole("button", { name: "הוסף חניך" }));
    await user.click(screen.getByRole("button", { name: "הוסף חניך" }));
    const breakInput = screen.getByLabelText("הפסקה ללא תשלום");
    await user.clear(breakInput);
    await user.type(breakInput, "30");
    expect(currencyText(32200)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "שמור משמרת" }));
    await screen.findByText("רשימת המשמרות נשמרה");
    expect(context.repository.saveShift).toHaveBeenCalledOnce();
    expect(context.repository.saveShift).toHaveBeenCalledWith(
      expect.objectContaining({
        workDate: "2026-11-09",
        breakMinutes: 30,
        counts: { student: 2, sigma: 0, privateShared: 0, privateSolo: 0 },
      }),
      0,
      undefined,
    );
  });

  it("keeps saved rates while changing the quantities and date of an old shift", async () => {
    const old = fixtureShift();
    const context = fixtureContext({
      shift: old,
      compensations: [
        fixtureCompensation(),
        fixtureCompensation({
          id: "00000000-0000-4000-8000-000000000004",
          effectiveFrom: "2026-11-01",
          ...fixtureRates({
            role: "checker",
            hourlyRate: 6000,
            studentRate: 2000,
          }),
        }),
      ],
    });
    const { user } = renderForm(context, `/shifts/${old.id}`);
    await screen.findByRole("heading", { name: "עריכת משמרת" });
    fireEvent.change(screen.getByLabelText(/תאריך המשמרת/), {
      target: { value: "2026-11-09" },
    });
    await user.click(screen.getByRole("button", { name: "הוסף חניך" }));
    expect(currencyText(35300)).toBeInTheDocument();
    expect(screen.getByText(/תעריפים שנשמרו במקור/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "שמור שינויים" }));
    await screen.findByText("רשימת המשמרות נשמרה");
    expect(context.repository.saveShift).toHaveBeenCalledWith(
      expect.objectContaining({
        id: old.id,
        workDate: "2026-11-09",
        counts: { student: 3, sigma: 0, privateShared: 0, privateSolo: 0 },
      }),
      old.version,
      undefined,
    );
  });

  it("blocks a final total and saving when solo packing needs an unknown rate", async () => {
    const { context, user } = renderForm();
    await user.click(screen.getByRole("button", { name: "הוסף פרטי לבד" }));
    expect(screen.getByText("נדרש עדכון לפני שמירה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "שמור משמרת" })).toBeDisabled();
    expect(screen.queryByText("סה״כ משוער ברוטו")).not.toBeInTheDocument();
    expect(context.repository.saveShift).not.toHaveBeenCalled();
  });

  it("labels negative adjustments and subtracts them from the live total", async () => {
    const { context, user } = renderForm();
    await user.click(screen.getByRole("button", { name: "הוסף בונוס" }));
    const adjustmentInput = screen.getByLabelText("סכום התאמה 1");
    await user.clear(adjustmentInput);
    await user.type(adjustmentInput, "-12.50");
    await user.type(screen.getByLabelText("תיאור ההתאמה"), "תיקון ידני");
    expect(screen.getByText("הפחתה מהשכר")).toBeInTheDocument();
    expect(currencyText(30750)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "שמור משמרת" }));
    await screen.findByText("רשימת המשמרות נשמרה");
    expect(context.repository.saveShift).toHaveBeenCalledWith(
      expect.objectContaining({
        bonuses: [
          expect.objectContaining({ amount: -1250, description: "תיקון ידני" }),
        ],
      }),
      0,
      undefined,
    );
  });

  it("retains a draft and reports a persistence failure without claiming it was saved", async () => {
    const context = fixtureContext();
    context.repository.saveShift.mockRejectedValueOnce(
      new Error("קיימת משמרת חופפת בשעות אלו."),
    );
    const { user } = renderForm(context);
    await user.click(screen.getByRole("button", { name: "הוסף סיגמה" }));
    await user.click(screen.getByRole("button", { name: "שמור משמרת" }));
    await screen.findByText("קיימת משמרת חופפת בשעות אלו.");
    expect(screen.getByLabelText("כמות סיגמה")).toHaveValue("1");
    expect(screen.queryByText("רשימת המשמרות נשמרה")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "שמור משמרת" })).toBeEnabled(),
    );
  });
});

describe("compensation settings", () => {
  it("does not carry regular packer rates into a checker configuration", async () => {
    const { context, user } = renderForm(fixtureContext(), "/settings");
    await user.click(screen.getByRole("textbox", { name: "התפקיד שלי" }));
    await user.click(screen.getByRole("option", { name: "צ׳קר / בודק שלבים" }));
    expect(screen.getByLabelText("שכר בסיס לשעה")).toHaveValue("");
    expect(screen.getByLabelText("חניך")).toHaveValue("");
    expect(screen.getByLabelText("סיגמה")).toHaveValue("");
    expect(screen.getByLabelText("פרטי בזוג")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "שמור תנאי שכר" }));
    await user.click(
      await screen.findByRole("button", { name: "אישור ושמירה" }),
    );
    await waitFor(() =>
      expect(
        context.repository.updateCompensationSettings,
      ).toHaveBeenCalledOnce(),
    );
    expect(context.repository.updateCompensationSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "checker",
        hourlyRate: null,
        studentRate: null,
        sigmaRate: null,
        privateSharedRate: null,
        privateSoloRate: null,
      }),
    );
    expect(context.refreshCompensations).toHaveBeenCalledOnce();
  });
});
