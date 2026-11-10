import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Timeline,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  CalendarClock,
  Check,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../app/context";
import { RateFields } from "../components/RateFields";
import {
  defaultRates,
  money,
  ratesSchema,
  roleLabels,
  selectCompensation,
  todayInJerusalem,
  type Rates,
} from "../domain";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "הפעולה לא הושלמה. כדאי לנסות שוב.";

export function SettingsPage() {
  const { repository, auth, user, compensations, refreshCompensations } =
    useApp();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const current = selectCompensation(compensations, todayInJerusalem());
  const [rates, setRates] = useState<Rates>(() =>
    ratesSchema.parse(current ?? defaultRates("regular")),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(todayInJerusalem());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmRates, setConfirmRates] = useState(false);
  const [email, setEmail] = useState(user.email ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [accountBusy, setAccountBusy] = useState("");
  const [accountError, setAccountError] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  async function saveRates() {
    setSaving(true);
    setError("");
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom))
        throw new Error("יש לבחור תאריך תחולה תקין.");
      if (
        rates.hourlyRate !== null &&
        rates.hourlyRate + rates.hourlyAdjustment < 0
      )
        throw new Error("השכר לשעה אחרי התאמה לא יכול להיות שלילי.");
      await repository.updateCompensationSettings({
        ...ratesSchema.parse(rates),
        effectiveFrom,
      });
      await refreshCompensations();
      setConfirmRates(false);
      notifications.show({
        title: "הגדרות השכר נשמרו",
        message: "המשמרות שכבר נשמרו שומרות על התעריפים המקוריים שלהן.",
        color: "teal",
        icon: <Check size={18} />,
      });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function updateAccount(
    kind: "email" | "password" | "reauthenticate" | "logout",
  ) {
    setAccountError("");
    setAccountBusy(kind);
    try {
      if (kind === "email") {
        await auth.updateEmail(email.trim());
        notifications.show({
          title: "בדיקת כתובת האימייל",
          message:
            "יש לבדוק את הודעות האישור שנשלחו לכתובות האימייל שלך ולהשלים את האימות.",
          color: "teal",
        });
      } else if (kind === "password") {
        if (password.length < 10)
          throw new Error("הסיסמה צריכה להכיל לפחות 10 תווים.");
        if (password !== passwordConfirm)
          throw new Error("הסיסמאות אינן תואמות.");
        await auth.updatePassword(
          password,
          verificationCode.trim() || undefined,
        );
        setPassword("");
        setPasswordConfirm("");
        setVerificationCode("");
        notifications.show({
          title: "הסיסמה עודכנה",
          message: "בכניסה הבאה אפשר להשתמש בסיסמה החדשה.",
          color: "teal",
        });
      } else if (kind === "reauthenticate") {
        await auth.reauthenticate();
        notifications.show({
          title: "קוד האימות נשלח",
          message:
            "יש לבדוק את האימייל של החשבון ולהזין את הקוד לפני עדכון הסיסמה.",
          color: "teal",
        });
      } else {
        await auth.signOut();
      }
    } catch (cause) {
      setAccountError(errorText(cause));
    } finally {
      setAccountBusy("");
    }
  }

  return (
    <Stack gap="xl">
      <Box>
        <Text className="eyebrow">בדיוק לפי התנאים שלך</Text>
        <Title order={1}>הפרופיל שלי</Title>
        <Text c="dimmed" mt={6}>
          התפקיד, התעריפים וכל מה שצריך כדי להרגיש בבית.
        </Text>
      </Box>
      <div className="settings-grid">
        <Stack gap="lg">
          <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
            <Group gap="sm" mb="sm">
              <CalendarClock size={22} />
              <Title order={3}>תפקיד ותנאי שכר</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="xl">
              כל שינוי נשמר עם תאריך התחלה. המשמרות הקיימות תמיד שומרות על
              תעריפי השכר שנשמרו איתן.
            </Text>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setConfirmRates(true);
              }}
            >
              <Stack gap="lg">
                <TextInput
                  label="בתוקף מתאריך"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(event) =>
                    setEffectiveFrom(event.currentTarget.value)
                  }
                  description="משמרות חדשות יקבלו את התעריפים המתאימים לתאריך שבו עבדת."
                  styles={{ input: { direction: "ltr", textAlign: "right" } }}
                />
                <RateFields
                  value={rates}
                  onChange={setRates}
                  disabled={saving}
                />
                {error && <Alert color="red">{error}</Alert>}
                <Button
                  type="submit"
                  size="md"
                  leftSection={<Save size={18} />}
                  loading={saving}
                >
                  שמור תנאי שכר
                </Button>
              </Stack>
            </form>
          </Paper>
          <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
            <Title order={3} mb="xl">
              היסטוריית תנאי שכר
            </Title>
            {compensations.length === 0 ? (
              <Text c="dimmed">עדיין אין תנאי שכר שמורים.</Text>
            ) : (
              <Timeline active={0} bulletSize={25} lineWidth={2}>
                {[...compensations]
                  .sort((a, b) =>
                    b.effectiveFrom.localeCompare(a.effectiveFrom),
                  )
                  .map((config) => (
                    <Timeline.Item
                      key={config.id}
                      title={
                        <Group gap="sm">
                          <Text fw={650}>{roleLabels[config.role]}</Text>
                          {config.effectiveFrom > todayInJerusalem() && (
                            <Badge size="xs" variant="light">
                              שינוי עתידי
                            </Badge>
                          )}
                        </Group>
                      }
                    >
                      <Text size="xs" c="dimmed" mt={3}>
                        בתוקף מ־{config.effectiveFrom}
                      </Text>
                      <Text size="sm" mt="sm">
                        שכר בסיס לשעה:{" "}
                        {config.hourlyRate === null
                          ? "טרם הוגדר"
                          : money(config.hourlyRate)}
                        {config.hourlyAdjustment !== 0
                          ? ` · התאמה: ${money(config.hourlyAdjustment)}`
                          : ""}
                        {config.creditedMinutes > 0
                          ? ` · ${config.creditedMinutes} דקות נוספות`
                          : ""}
                      </Text>
                      <Text size="xs" c="dimmed" mt={3}>
                        חניך{" "}
                        {config.studentRate === null
                          ? "—"
                          : money(config.studentRate)}{" "}
                        · סיגמה{" "}
                        {config.sigmaRate === null
                          ? "—"
                          : money(config.sigmaRate)}{" "}
                        · פרטי בזוג{" "}
                        {config.privateSharedRate === null
                          ? "—"
                          : money(config.privateSharedRate)}{" "}
                        · פרטי לבד{" "}
                        {config.privateSoloRate === null
                          ? "—"
                          : money(config.privateSoloRate)}
                      </Text>
                      <Button
                        variant="subtle"
                        size="xs"
                        px={0}
                        mt={5}
                        onClick={() => {
                          setRates(ratesSchema.parse(config));
                          setEffectiveFrom(config.effectiveFrom);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        טען לתיקון ההגדרה
                      </Button>
                    </Timeline.Item>
                  ))}
              </Timeline>
            )}
          </Paper>
        </Stack>
        <Stack gap="lg">
          <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
            <Group mb="lg">
              <div className="profile-avatar">
                <ShieldCheck size={25} />
              </div>
              <Box>
                <Text fw={700}>החשבון שלך</Text>
                <Text
                  size="sm"
                  c="dimmed"
                  dir="ltr"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {user.email}
                </Text>
              </Box>
            </Group>
            <Badge color="teal" variant="light">
              {current ? roleLabels[current.role] : "נדרשת הגדרת תפקיד"}
            </Badge>
            <Divider my="lg" />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void updateAccount("email");
              }}
            >
              <Stack gap="sm">
                <TextInput
                  label="כתובת אימייל"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  leftSection={<Mail size={16} />}
                  autoComplete="email"
                  styles={{ input: { direction: "ltr", textAlign: "left" } }}
                />
                <Button
                  type="submit"
                  variant="light"
                  loading={accountBusy === "email"}
                  disabled={Boolean(accountBusy) || email.trim() === user.email}
                >
                  עדכן כתובת אימייל
                </Button>
                <Text size="xs" c="dimmed">
                  השינוי יושלם לאחר אישור לפי מדיניות האימות של החשבון.
                </Text>
              </Stack>
            </form>
            <Divider my="lg" />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void updateAccount("password");
              }}
            >
              <Stack gap="sm">
                <PasswordInput
                  label="סיסמה חדשה"
                  minLength={10}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  autoComplete="new-password"
                  description="לפחות 10 תווים"
                />
                <PasswordInput
                  label="אימות הסיסמה החדשה"
                  minLength={10}
                  required
                  value={passwordConfirm}
                  onChange={(event) =>
                    setPasswordConfirm(event.currentTarget.value)
                  }
                  autoComplete="new-password"
                />
                <TextInput
                  label="קוד אימות לשינוי סיסמה"
                  description="אם נדרש אימות נוסף, אפשר לבקש קוד באימייל ולהזין אותו כאן."
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(event.currentTarget.value)
                  }
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={32}
                />
                <Button
                  type="button"
                  variant="subtle"
                  size="xs"
                  loading={accountBusy === "reauthenticate"}
                  disabled={Boolean(accountBusy)}
                  onClick={() => void updateAccount("reauthenticate")}
                >
                  שלח קוד אימות באימייל
                </Button>
                <Button
                  type="submit"
                  variant="light"
                  loading={accountBusy === "password"}
                  disabled={Boolean(accountBusy)}
                >
                  עדכן סיסמה
                </Button>
              </Stack>
            </form>
            {accountError && (
              <Alert color="red" mt="md">
                {accountError}
              </Alert>
            )}
          </Paper>
          <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
            <Title order={3} mb="sm">
              נעים לעיניים
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              בחר את המראה שמתאים לך.
            </Text>
            <SegmentedControl
              fullWidth
              value={colorScheme}
              onChange={(value) =>
                setColorScheme(value as "light" | "dark" | "auto")
              }
              data={[
                { value: "light", label: "בהיר" },
                { value: "dark", label: "כהה" },
                { value: "auto", label: "לפי המכשיר" },
              ]}
            />
          </Paper>
          <Button
            variant="subtle"
            color="red"
            size="md"
            leftSection={<LogOut size={17} />}
            onClick={() => setLogoutConfirm(true)}
          >
            התנתקות מהחשבון
          </Button>
        </Stack>
      </div>
      <Modal
        opened={confirmRates}
        onClose={() => {
          if (!saving) setConfirmRates(false);
        }}
        title="שמירת תנאי השכר"
        centered
        radius="lg"
      >
        <Stack>
          <Text>
            התעריפים יחולו על משמרות חדשות מתאריך {effectiveFrom}. משמרות שכבר
            נשמרו לא ישתנו.
          </Text>
          {compensations.some(
            (config) => config.effectiveFrom === effectiveFrom,
          ) && (
            <Alert color="orange">
              קיימת הגדרה לתאריך זה. השמירה תתקן אותה עבור משמרות שיישמרו
              מעכשיו.
            </Alert>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={saving}
              onClick={() => setConfirmRates(false)}
            >
              ביטול
            </Button>
            <Button loading={saving} onClick={() => void saveRates()}>
              אישור ושמירה
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="להתנתק מ־PackTrack?"
        centered
        radius="lg"
      >
        <Stack>
          <Text>המשמרות השמורות יחכו לך בכניסה הבאה.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLogoutConfirm(false)}>
              להישאר
            </Button>
            <Button
              color="red"
              loading={accountBusy === "logout"}
              onClick={() => void updateAccount("logout")}
            >
              התנתקות
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default SettingsPage;
