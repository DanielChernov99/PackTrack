import { useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import type { AuthAdapter } from "../data";
import { decimalToAgorot, roleLabels } from "../domain";
import type { Role } from "../domain";
import { Brand } from "../components/Brand";
import { messageOf } from "../components/Common";
export default function AuthPage({
  auth,
  recovery = false,
  onRecovered,
}: {
  auth: AuthAdapter;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<Role>("regular");
  const [hourly, setHourly] = useState<string | number>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return query.has("error") || hash.has("error")
      ? "קישור האימות לא תקין או שפג תוקפו. אפשר להתחבר או לבקש קישור חדש."
      : "";
  });
  const [verification, setVerification] = useState(false);
  const title = recovery
    ? "בוחרים סיסמה חדשה"
    : mode === "register"
      ? "המשמרת הראשונה מתחילה כאן"
      : mode === "reset"
        ? "נחזיר אותך לעניינים"
        : "טוב לראות אותך שוב.";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (!recovery && !z.email().safeParse(email.trim()).success)
        throw new Error("יש להזין כתובת אימייל תקינה");
      if ((recovery || mode === "register") && password.length < 10)
        throw new Error("הסיסמה צריכה להכיל לפחות 10 תווים");
      if ((recovery || mode === "register") && password !== confirm)
        throw new Error("הסיסמאות אינן תואמות");
      if (recovery) {
        await auth.updatePassword(password);
        onRecovered?.();
      } else if (mode === "login") {
        await auth.signIn(email.trim(), password);
      } else if (mode === "reset") {
        await auth.resetPassword(email.trim());
        setNotice(
          "אם קיים חשבון עם הכתובת הזו, יישלח אליו קישור לאיפוס סיסמה.",
        );
      } else {
        const result = await auth.signUp(
          email.trim(),
          password,
          role,
          hourly === "" ? null : decimalToAgorot(hourly),
        );
        if (result.needsEmailVerification) {
          setVerification(true);
          setNotice(
            "כמעט שם! שלחנו קישור לאימות האימייל. פותחים אותו וחוזרים לכאן.",
          );
        }
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      await auth.resendVerification(email.trim());
      setNotice("בקשת שליחת קישור האימות התקבלה. כדאי לבדוק גם בדואר זבל.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setNotice("");
    setVerification(false);
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-copy">
          <span className="tiny-label">LESS ADMIN. MORE AIRTIME.</span>
          <h1>
            את הקיפול
            <br />
            כבר סיימת.
            <br />
            <span>השאר עלינו.</span>
          </h1>
          <p>
            כל השעות, המצנחים והשכר שלך.
            <br />
            מסודרים, ברורים, ותמיד איתך.
          </p>
          <div className="auth-points">
            <span>
              <CheckCircle2 size={17} /> תיעוד משמרת בכמה רגעים
            </span>
            <span>
              <CheckCircle2 size={17} /> השכר ההיסטורי שלך נשמר
            </span>
            <span>
              <CheckCircle2 size={17} /> תמונה ברורה בסוף החודש
            </span>
          </div>
        </div>
        <div className="auth-bottom">
          נבנה עבור האנשים שמאחורי כל נחיתה טובה.
        </div>
        <svg className="auth-art" viewBox="0 0 400 350" aria-hidden="true">
          <path d="M25 170a175 175 0 0 1 350 0M25 170q58-60 116 0 58-60 117 0 58-60 117 0M25 170l175 160 175-160M141 170l59 160 58-160M141 170q-15-140 59-175 75 35 58 175" />
        </svg>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <Paper className="auth-form">
          <span className="eyebrow">ברוכים הבאים ל־PACKTRACK</span>
          <Title order={2} mt={12}>
            {title}
          </Title>
          <Text c="dimmed" mt={8} mb={30}>
            {recovery
              ? "סיסמה חדשה, וכל הנתונים שלך מחכים לך."
              : mode === "register"
                ? "פותחים חשבון אישי ומתחילים לעקוב."
                : mode === "reset"
                  ? "נשלח לך קישור לאיפוס הסיסמה."
                  : "מתחברים ועושים סדר ביום העבודה."}
          </Text>
          <form onSubmit={submit}>
            <Stack gap="md">
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              {notice && (
                <Alert color="teal" role="status">
                  {notice}
                </Alert>
              )}
              {!recovery && (
                <TextInput
                  label="כתובת אימייל"
                  placeholder="you@example.com"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
              {(recovery || mode !== "reset") && (
                <PasswordInput
                  label={recovery ? "סיסמה חדשה" : "סיסמה"}
                  placeholder={
                    mode === "register" || recovery
                      ? "לפחות 10 תווים"
                      : "הסיסמה שלך"
                  }
                  autoComplete={
                    mode === "login" && !recovery
                      ? "current-password"
                      : "new-password"
                  }
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" || recovery ? 10 : undefined}
                />
              )}
              {(recovery || mode === "register") && (
                <PasswordInput
                  label="אימות סיסמה"
                  autoComplete="new-password"
                  dir="ltr"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              )}
              {!recovery && mode === "register" && (
                <>
                  <Select
                    label="התפקיד שלך"
                    data={Object.entries(roleLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    value={role}
                    onChange={(v) => setRole(v as Role)}
                    allowDeselect={false}
                  />
                  <NumberInput
                    label="שכר שעתי (₪)"
                    description="אפשר להגדיר עכשיו או בהמשך בהגדרות השכר"
                    value={hourly}
                    onChange={setHourly}
                    min={0}
                    max={10000}
                    decimalScale={2}
                  />
                  <Text size="xs" c="dimmed">
                    {role === "regular"
                      ? "תעריפים התחלתיים: חניך וסיגמה 11 ₪, פרטי בזוג 9 ₪. פרטי לבד דורש הגדרה."
                      : "תעריפי התפקיד יוגדרו בהגדרות השכר לאחר ההרשמה."}
                  </Text>
                </>
              )}
              {!recovery && mode === "login" && (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  ta="left"
                  onClick={() => changeMode("reset")}
                >
                  שכחת סיסמה?
                </Anchor>
              )}
              <Button
                type="submit"
                size="md"
                fullWidth
                loading={busy}
                rightSection={<ArrowLeft size={18} />}
              >
                {recovery
                  ? "שמירת סיסמה חדשה"
                  : mode === "register"
                    ? "יצירת חשבון"
                    : mode === "reset"
                      ? "שליחת קישור איפוס"
                      : "כניסה לחשבון"}
              </Button>
              {verification && (
                <Button variant="subtle" onClick={resend} loading={busy}>
                  שלח שוב קישור אימות
                </Button>
              )}
            </Stack>
          </form>
          {!recovery && (
            <Text size="sm" ta="center" mt={24}>
              {mode === "login"
                ? "עוד אין לך חשבון? "
                : mode === "register"
                  ? "כבר רשום? "
                  : ""}
              <Anchor
                component="button"
                onClick={() =>
                  changeMode(mode === "login" ? "register" : "login")
                }
              >
                {mode === "login" ? "בוא נתחיל" : "חזרה להתחברות"}
              </Anchor>
            </Text>
          )}
          <div className="auth-privacy">
            <ShieldCheck size={15} />
            <span>החשבון אישי. נתוני השכר שלך נשארים שלך.</span>
          </div>
        </Paper>
        <Text className="auth-copyright" size="xs" c="dimmed">
          PackTrack · כל קיפול נחשב.
        </Text>
      </main>
    </div>
  );
}
