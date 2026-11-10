import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  ArrowRight,
  Check,
  Clock3,
  Info,
  Minus,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useApp } from "../app/context";
import { RateFields } from "../components/RateFields";
import {
  calculateEarnings,
  defaultRates,
  money,
  roleLabels,
  selectCompensation,
  todayInJerusalem,
  type Counts,
  type Rates,
  type Shift,
  type ShiftDraft,
} from "../domain";

const countLabels: {
  key: keyof Counts;
  label: string;
  hint: string;
  rate: keyof Rates;
}[] = [
  { key: "student", label: "חניך", hint: "מצנחי חניכים", rate: "studentRate" },
  { key: "sigma", label: "סיגמה", hint: "מצנחי טנדם", rate: "sigmaRate" },
  {
    key: "privateShared",
    label: "פרטי בזוג",
    hint: "קיפול עם אדם נוסף",
    rate: "privateSharedRate",
  },
  {
    key: "privateSolo",
    label: "פרטי לבד",
    hint: "קיפול באופן עצמאי",
    rate: "privateSoloRate",
  },
];

function emptyDraft(): ShiftDraft {
  return {
    id: crypto.randomUUID(),
    workDate: todayInJerusalem(),
    startTime: "08:00",
    endTime: "16:00",
    endNextDay: false,
    timeDisambiguation: "reject",
    breakMinutes: 0,
    counts: { student: 0, sigma: 0, privateShared: 0, privateSolo: 0 },
    bonuses: [],
    notes: "",
  };
}

const explainError = (error: unknown) =>
  error instanceof Error ? error.message : "הפעולה לא הושלמה. כדאי לנסות שוב.";

export function ShiftEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { repository, compensations } = useApp();
  const [draft, setDraft] = useState<ShiftDraft>(emptyDraft);
  const [original, setOriginal] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [override, setOverride] = useState<Rates>(defaultRates("regular"));
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const compensationSelection = useMemo(() => {
    try {
      return {
        effective: selectCompensation(compensations, draft.workDate),
        error: "",
      };
    } catch (error) {
      return { effective: null, error: explainError(error) };
    }
  }, [compensations, draft.workDate]);
  const effective = compensationSelection.effective;
  const rates = overrideEnabled ? override : (original?.snapshot ?? effective);

  useEffect(() => {
    if (!id) return;
    let active = true;
    repository
      .getShift(id)
      .then((found) => {
        if (!active) return;
        if (!found)
          throw new Error("המשמרת לא נמצאה או שאין לך הרשאה לצפות בה.");
        setDraft(found);
        setOriginal(found);
        setOverride(found.snapshot);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(explainError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, repository]);

  const estimate = useMemo(() => {
    if (compensationSelection.error)
      return { value: null, error: compensationSelection.error };
    if (!rates)
      return {
        value: null,
        error:
          "לא נמצאו תעריפים בתוקף בתאריך המשמרת. יש להוסיף הגדרת שכר לתאריך זה בפרופיל.",
      };
    try {
      return { value: calculateEarnings(draft, rates), error: "" };
    } catch (error) {
      return { value: null, error: explainError(error) };
    }
  }, [draft, rates, compensationSelection.error]);

  const update = <K extends keyof ShiftDraft>(key: K, value: ShiftDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const updateCount = (key: keyof Counts, value: number) =>
    setDraft((previous) => ({
      ...previous,
      counts: {
        ...previous.counts,
        [key]: Math.max(0, Math.min(10000, value)),
      },
    }));

  async function save() {
    if (!estimate.value || (overrideEnabled && !overrideConfirmed) || saving)
      return;
    setSaving(true);
    setSaveError("");
    try {
      await repository.saveShift(
        draft,
        original?.version ?? 0,
        overrideEnabled ? override : undefined,
      );
      notifications.show({
        title: original ? "המשמרת עודכנה" : "המשמרת נשמרה",
        message: "הסכומים שלך מעודכנים. עבודה טובה!",
        color: "teal",
        icon: <Check size={18} />,
      });
      navigate("/shifts");
    } catch (error) {
      setSaveError(explainError(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Stack align="center" py={80}>
        <Loader color="teal" />
        <Text c="dimmed">טוענים את המשמרת…</Text>
      </Stack>
    );
  if (loadError)
    return (
      <Alert color="red" title="לא הצלחנו לטעון את המשמרת">
        <Stack>
          <Text>{loadError}</Text>
          <Button component={Link} to="/shifts" variant="light">
            בחזרה למשמרות
          </Button>
        </Stack>
      </Alert>
    );

  return (
    <Stack gap="xl">
      <Box>
        <Button
          component={Link}
          to="/shifts"
          variant="subtle"
          color="gray"
          leftSection={<ArrowRight size={16} />}
          px={0}
          mb="sm"
        >
          לכל המשמרות
        </Button>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text className="eyebrow">כל קיפול נחשב</Text>
            <Title order={1}>{original ? "עריכת משמרת" : "הוסף משמרת"}</Title>
            <Text c="dimmed" mt={6}>
              מספר פרטים קטנים, ותמונת השכר שלך מעודכנת.
            </Text>
          </Box>
          <Badge variant="light" color="teal" size="lg">
            {original ? "עדכון משמרת" : "משמרת חדשה"}
          </Badge>
        </Group>
      </Box>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="shift-editor-grid">
          <Stack gap="lg">
            <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
              <Group gap="sm" mb="lg">
                <Clock3 size={21} />
                <Title order={3}>מתי עבדת?</Title>
              </Group>
              <Stack gap="md">
                <TextInput
                  label="תאריך המשמרת"
                  type="date"
                  required
                  value={draft.workDate}
                  onChange={(event) =>
                    update("workDate", event.currentTarget.value)
                  }
                  styles={{ input: { direction: "ltr", textAlign: "right" } }}
                />
                <SimpleGrid cols={2}>
                  <TextInput
                    label="שעת כניסה"
                    type="time"
                    required
                    value={draft.startTime}
                    onChange={(event) =>
                      update("startTime", event.currentTarget.value)
                    }
                    styles={{ input: { direction: "ltr" } }}
                  />
                  <TextInput
                    label="שעת יציאה"
                    type="time"
                    required
                    value={draft.endTime}
                    onChange={(event) =>
                      update("endTime", event.currentTarget.value)
                    }
                    styles={{ input: { direction: "ltr" } }}
                  />
                </SimpleGrid>
                <Checkbox
                  checked={draft.endNextDay}
                  onChange={(event) =>
                    update("endNextDay", event.currentTarget.checked)
                  }
                  label="המשמרת הסתיימה ביום הבא"
                  description="למשמרת שעוברת את חצות"
                />
                <NumberInput
                  label="הפסקה ללא תשלום"
                  description="בדקות; אין צורך להזין אם לא הייתה הפסקה"
                  value={draft.breakMinutes}
                  onChange={(value) =>
                    update("breakMinutes", Number(value) || 0)
                  }
                  min={0}
                  max={1439}
                  allowDecimal={false}
                  allowNegative={false}
                  suffix=" דקות"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setAdvanced(!advanced)}
                  style={{ alignSelf: "flex-start" }}
                >
                  אפשרויות זמן מתקדמות
                </Button>
                {advanced && (
                  <Select
                    label="שעה שחוזרת במעבר לשעון חורף"
                    description="רק אם השעון מציג את אותה שעה פעמיים. שעות שלא קיימות במעבר לשעון קיץ אינן מותרות."
                    value={draft.timeDisambiguation}
                    allowDeselect={false}
                    data={[
                      {
                        value: "reject",
                        label: "בקש ממני לבחור במקרה של אי־בהירות",
                      },
                      { value: "earlier", label: "המופע הראשון של השעה" },
                      { value: "later", label: "המופע השני של השעה" },
                    ]}
                    onChange={(value) => {
                      if (value)
                        update(
                          "timeDisambiguation",
                          value as ShiftDraft["timeDisambiguation"],
                        );
                    }}
                  />
                )}
                <Text size="xs" c="dimmed">
                  כל הזמנים לפי שעון ישראל · Asia/Jerusalem
                </Text>
              </Stack>
            </Paper>
            <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
              <Title order={3} mb={4}>
                כמה מצנחים קיפלת?
              </Title>
              <Text size="sm" c="dimmed" mb="lg">
                הכמויות והתעריפים מרכיבים את שכר הקיפולים שלך.
              </Text>
              <Stack gap="sm">
                {countLabels.map(({ key, label, hint, rate }) => (
                  <div className="quantity-row" key={key}>
                    <Box>
                      <Text fw={650}>{label}</Text>
                      <Text size="xs" c="dimmed">
                        {hint} ·{" "}
                        {rates && typeof rates[rate] === "number"
                          ? `${money(rates[rate] as number)} ליחידה`
                          : "התעריף טרם הוגדר"}
                      </Text>
                    </Box>
                    <Group gap={6} wrap="nowrap" dir="ltr">
                      <ActionIcon
                        type="button"
                        variant="light"
                        color="gray"
                        size="lg"
                        radius="md"
                        aria-label={`הפחת ${label}`}
                        disabled={draft.counts[key] === 0}
                        onClick={() => updateCount(key, draft.counts[key] - 1)}
                      >
                        <Minus size={16} />
                      </ActionIcon>
                      <NumberInput
                        aria-label={`כמות ${label}`}
                        value={draft.counts[key]}
                        onChange={(value) =>
                          updateCount(key, Number(value) || 0)
                        }
                        hideControls
                        min={0}
                        max={10000}
                        allowDecimal={false}
                        allowNegative={false}
                        w={74}
                        styles={{
                          input: { textAlign: "center", fontWeight: 700 },
                        }}
                        inputMode="numeric"
                      />
                      <ActionIcon
                        type="button"
                        variant="light"
                        color="teal"
                        size="lg"
                        radius="md"
                        aria-label={`הוסף ${label}`}
                        disabled={draft.counts[key] >= 10000}
                        onClick={() => updateCount(key, draft.counts[key] + 1)}
                      >
                        <Plus size={16} />
                      </ActionIcon>
                    </Group>
                  </div>
                ))}
              </Stack>
            </Paper>
            <Paper withBorder radius="xl" p={{ base: "lg", sm: "xl" }}>
              <Group justify="space-between" mb="sm">
                <Title order={3}>בונוסים והתאמות</Title>
                <Button
                  type="button"
                  variant="light"
                  size="xs"
                  leftSection={<Plus size={15} />}
                  disabled={draft.bonuses.length >= 50}
                  onClick={() =>
                    update("bonuses", [
                      ...draft.bonuses,
                      { id: crypto.randomUUID(), amount: 0, description: "" },
                    ])
                  }
                >
                  הוסף בונוס
                </Button>
              </Group>
              <Text c="dimmed" size="sm" mb="lg">
                תשלום נוסף או תיקון ידני. סכום שלילי מפחית מהשכר.
              </Text>
              <Stack gap="md">
                {draft.bonuses.length === 0 && (
                  <Text size="sm" c="dimmed">
                    אין בונוסים במשמרת הזו. אפשר להוסיף גם בהמשך.
                  </Text>
                )}
                {draft.bonuses.map((bonus, index) => (
                  <Paper key={bonus.id ?? index} withBorder p="md" radius="md">
                    <Stack gap="sm">
                      <Group wrap="nowrap" align="flex-end">
                        <NumberInput
                          style={{ flex: 1 }}
                          label={`סכום התאמה ${index + 1}`}
                          value={bonus.amount / 100}
                          decimalScale={2}
                          min={-100000}
                          max={100000}
                          suffix=" ₪"
                          inputMode="decimal"
                          onChange={(value) =>
                            update(
                              "bonuses",
                              draft.bonuses.map((item, position) =>
                                position === index
                                  ? {
                                      ...item,
                                      amount: Math.round(
                                        (Number(value) || 0) * 100,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          color="red"
                          size="lg"
                          aria-label={`הסר בונוס ${index + 1}`}
                          onClick={() =>
                            update(
                              "bonuses",
                              draft.bonuses.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={18} />
                        </ActionIcon>
                      </Group>
                      {bonus.amount < 0 && (
                        <Badge color="orange" variant="light">
                          הפחתה מהשכר
                        </Badge>
                      )}
                      <TextInput
                        label="תיאור ההתאמה"
                        placeholder="למשל, בונוס מיוחד על קיפולים"
                        value={bonus.description}
                        maxLength={200}
                        onChange={(event) => {
                          const description = event.currentTarget.value;
                          update(
                            "bonuses",
                            draft.bonuses.map((item, position) =>
                              position === index
                                ? { ...item, description }
                                : item,
                            ),
                          );
                        }}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              <Divider my="lg" />
              <Textarea
                label="הערות"
                placeholder="משהו שחשוב לזכור מהמשמרת?"
                value={draft.notes}
                onChange={(event) => update("notes", event.currentTarget.value)}
                maxLength={2000}
                autosize
                minRows={3}
                description={`${draft.notes.length}/2000`}
              />
            </Paper>
            {original && (
              <Paper withBorder radius="xl" p="lg">
                <Stack gap="md">
                  <Alert
                    color="teal"
                    icon={<Info size={18} />}
                    title="התעריפים ההיסטוריים נשמרים"
                  >
                    עריכת כמויות או שעות משתמשת בתעריפים שנשמרו עם המשמרת, גם אם
                    התפקיד או התאריך השתנו.
                  </Alert>
                  <Switch
                    label="תיקון מתקדם של התעריפים במשמרת הזו"
                    checked={overrideEnabled}
                    onChange={(event) => {
                      setOverrideEnabled(event.currentTarget.checked);
                      setOverrideConfirmed(false);
                    }}
                  />
                  {overrideEnabled && (
                    <>
                      <RateFields
                        value={override}
                        onChange={(value) => {
                          setOverride(value);
                          setOverrideConfirmed(false);
                        }}
                      />
                      <Checkbox
                        checked={overrideConfirmed}
                        onChange={(event) =>
                          setOverrideConfirmed(event.currentTarget.checked)
                        }
                        label="אני מאשר/ת להחליף את התעריפים ההיסטוריים של משמרת זו בלבד."
                      />
                    </>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
          <aside className="shift-summary">
            <Paper
              withBorder
              radius="xl"
              p={{ base: "lg", sm: "xl" }}
              className="estimate-card"
            >
              <Badge color="teal" variant="light" mb="md">
                חישוב בזמן אמת
              </Badge>
              <Title order={3}>סיכום המשמרת</Title>
              {rates && (
                <Text c="dimmed" size="sm" mt={5}>
                  {roleLabels[rates.role]}
                  {original && !overrideEnabled
                    ? " · תעריפים שנשמרו במקור"
                    : effective
                      ? ` · בתוקף מ־${effective.effectiveFrom}`
                      : ""}
                </Text>
              )}
              <Divider my="lg" />
              {estimate.value ? (
                <Stack gap="md">
                  <SummaryLine
                    label="שעות עבודה לתשלום"
                    value={(estimate.value.paidMinutes / 60).toFixed(2)}
                  />
                  {estimate.value.creditedMinutes > 0 && (
                    <SummaryLine
                      label="תוספת זמן לתשלום"
                      value={`${estimate.value.creditedMinutes} דקות`}
                    />
                  )}
                  <SummaryLine
                    label="שכר שעתי"
                    value={money(estimate.value.hourly)}
                  />
                  {countLabels.map(({ key, label }) => (
                    <SummaryLine
                      key={key}
                      label={`${label} × ${draft.counts[key]}`}
                      value={money(estimate.value!.breakdown[key])}
                    />
                  ))}
                  <SummaryLine
                    label="בונוסים והתאמות"
                    value={money(estimate.value.bonuses)}
                  />
                  <Divider />
                  <Box>
                    <Text size="sm" c="dimmed">
                      סה״כ משוער ברוטו
                    </Text>
                    <Text
                      className="estimate-total"
                      fw={800}
                      fz={36}
                      mt={4}
                      dir="ltr"
                      ta="right"
                    >
                      {money(estimate.value.total)}
                    </Text>
                  </Box>
                  <Text size="xs" c="dimmed">
                    ההערכה אינה כוללת ניכויי מס או הפרשות.
                  </Text>
                </Stack>
              ) : (
                <Alert
                  color="orange"
                  title="נדרש עדכון לפני שמירה"
                  icon={<Info size={18} />}
                >
                  <Text size="sm">{estimate.error}</Text>
                  <Button
                    component={Link}
                    to="/settings"
                    size="xs"
                    variant="subtle"
                    color="orange"
                    mt="sm"
                  >
                    להגדרות השכר
                  </Button>
                </Alert>
              )}
              {saveError && (
                <Alert color="red" mt="md" title="המשמרת לא נשמרה">
                  {saveError}
                </Alert>
              )}
              <Button
                type="submit"
                fullWidth
                size="lg"
                radius="md"
                mt="xl"
                leftSection={<Save size={19} />}
                loading={saving}
                disabled={
                  !estimate.value || (overrideEnabled && !overrideConfirmed)
                }
              >
                {original ? "שמור שינויים" : "שמור משמרת"}
              </Button>
              <Button
                component={Link}
                to="/shifts"
                fullWidth
                variant="subtle"
                color="gray"
                mt="xs"
              >
                ביטול
              </Button>
            </Paper>
          </aside>
        </div>
      </form>
    </Stack>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={650} dir="ltr">
        {value}
      </Text>
    </Group>
  );
}

export default ShiftEditor;
