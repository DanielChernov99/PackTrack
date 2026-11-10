import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import AuthPage from "./AuthPage";
import Configuration from "./Configuration";
import { fixtureContext } from "../test/fixtures";
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});
function setup(recovery = false) {
  const auth = fixtureContext().auth;
  const onRecovered = vi.fn();
  render(
    <MantineProvider env="test">
      <AuthPage auth={auth} recovery={recovery} onRecovered={onRecovered} />
    </MantineProvider>,
  );
  return { auth, onRecovered, user: userEvent.setup() };
}
describe("account entry and recovery", () => {
  it("registers the selected role without inventing an hourly wage", async () => {
    const { auth, user } = setup();
    await user.click(screen.getByRole("button", { name: "בוא נתחיל" }));
    await user.type(
      screen.getByLabelText(/כתובת אימייל/),
      "packer@example.test",
    );
    await user.type(screen.getByLabelText(/^סיסמה/), "Test-only-pass");
    await user.type(screen.getByLabelText(/^אימות סיסמה/), "Test-only-pass");
    await user.click(screen.getByRole("textbox", { name: "התפקיד שלך" }));
    await user.click(screen.getByRole("option", { name: "צ׳קר / בודק שלבים" }));
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));
    expect(auth.signUp).toHaveBeenCalledWith(
      "packer@example.test",
      "Test-only-pass",
      "checker",
      null,
    );
    expect(await screen.findByText(/שלחנו קישור לאימות/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "שלח שוב קישור אימות" }),
    );
    expect(auth.resendVerification).toHaveBeenCalledWith("packer@example.test");
  });
  it("rejects mismatched confirmation before registering", async () => {
    const { auth, user } = setup();
    await user.click(screen.getByRole("button", { name: "בוא נתחיל" }));
    await user.type(
      screen.getByLabelText(/כתובת אימייל/),
      "packer@example.test",
    );
    await user.type(screen.getByLabelText(/^סיסמה/), "Test-only-pass");
    await user.type(screen.getByLabelText(/^אימות סיסמה/), "Different-pass");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "הסיסמאות אינן תואמות",
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("requests password recovery with a non-enumerating confirmation", async () => {
    const { auth, user } = setup();
    await user.click(screen.getByRole("button", { name: "שכחת סיסמה?" }));
    await user.type(
      screen.getByLabelText(/כתובת אימייל/),
      "packer@example.test",
    );
    await user.click(screen.getByRole("button", { name: "שליחת קישור איפוס" }));
    expect(auth.resetPassword).toHaveBeenCalledWith("packer@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "אם קיים חשבון",
    );
  });
  it("returns only after a new password is successfully saved", async () => {
    const { auth, onRecovered, user } = setup(true);
    await user.type(screen.getByLabelText(/^סיסמה חדשה/), "New-test-password");
    await user.type(screen.getByLabelText(/^אימות סיסמה/), "New-test-password");
    await user.click(screen.getByRole("button", { name: "שמירת סיסמה חדשה" }));
    expect(auth.updatePassword).toHaveBeenCalledWith("New-test-password");
    expect(onRecovered).toHaveBeenCalledOnce();
  });
  it("explains an expired verification link", () => {
    window.history.replaceState({}, "", "/auth/callback?error=access_denied");
    setup();
    expect(screen.getByRole("status")).toHaveTextContent(
      "קישור האימות לא תקין",
    );
  });
  it("shows actionable setup instructions without pretending to have account data", () => {
    render(
      <MantineProvider env="test">
        <Configuration message="Missing Supabase configuration" />
      </MantineProvider>,
    );
    expect(screen.getByText("Missing Supabase configuration")).toBeVisible();
    expect(screen.getAllByText(/VITE_SUPABASE_URL/)).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "כניסה לחשבון" }),
    ).not.toBeInTheDocument();
  });
});
