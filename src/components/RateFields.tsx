import {
  Alert,
  Divider,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { Info } from "lucide-react";
import { defaultRates, roleLabels, type Rates, type Role } from "../domain";

interface RateFieldsProps {
  value: Rates;
  onChange: (value: Rates) => void;
  disabled?: boolean;
  showRole?: boolean;
}

/** Inputs are displayed in shekels; all application money is integer agorot. */
export function RateFields({
  value,
  onChange,
  disabled,
  showRole = true,
}: RateFieldsProps) {
  const amount = (key: keyof Rates, raw: string | number, nullable = true) => {
    const next =
      raw === "" ? (nullable ? null : 0) : Math.round(Number(raw) * 100);
    if (next === null || Number.isFinite(next))
      onChange({ ...value, [key]: next });
  };

  return (
    <Stack gap="lg">
      {showRole && (
        <Select
          label="התפקיד שלי"
          data={Object.entries(roleLabels).map(([v, label]) => ({
            value: v,
            label,
          }))}
          value={value.role}
          disabled={disabled}
          allowDeselect={false}
          onChange={(role) => {
            if (role) onChange(defaultRates(role as Role));
          }}
          description="בחירת תפקיד אחר טוענת רק את התעריפים הידועים עבורו."
        />
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <NumberInput
          label="שכר בסיס לשעה"
          description="בשקלים, לפני תוספות"
          placeholder="יש להגדיר"
          value={value.hourlyRate === null ? "" : value.hourlyRate / 100}
          onChange={(v) => amount("hourlyRate", v)}
          min={0}
          max={10000}
          decimalScale={2}
          allowNegative={false}
          suffix=" ₪"
          disabled={disabled}
          inputMode="decimal"
        />
        <NumberInput
          label="תוספת לשעה"
          description="תוספת לתעריף הבסיס; אפשר גם הפחתה"
          value={value.hourlyAdjustment / 100}
          onChange={(v) => amount("hourlyAdjustment", v, false)}
          min={-10000}
          max={10000}
          decimalScale={2}
          suffix=" ₪"
          disabled={disabled}
          inputMode="decimal"
        />
        <NumberInput
          label="דקות נוספות לתשלום"
          description="תוספת זמן קבועה לכל משמרת, רק אם הוסכמה במועדון"
          value={value.creditedMinutes}
          onChange={(v) =>
            onChange({ ...value, creditedMinutes: Number(v) || 0 })
          }
          min={0}
          max={1440}
          allowDecimal={false}
          allowNegative={false}
          suffix=" דקות"
          disabled={disabled}
          inputMode="numeric"
        />
      </SimpleGrid>
      <Divider label="תעריף לכל מצנח" labelPosition="right" />
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        {(
          [
            ["studentRate", "חניך"],
            ["sigmaRate", "סיגמה"],
            ["privateSharedRate", "פרטי בזוג"],
            ["privateSoloRate", "פרטי לבד"],
          ] as const
        ).map(([key, label]) => (
          <NumberInput
            key={key}
            label={label}
            placeholder="טרם הוגדר"
            value={value[key] === null ? "" : value[key]! / 100}
            onChange={(v) => amount(key, v)}
            min={0}
            max={10000}
            decimalScale={2}
            allowNegative={false}
            suffix=" ₪"
            disabled={disabled}
            inputMode="decimal"
          />
        ))}
      </SimpleGrid>
      <Alert variant="light" color="teal" icon={<Info size={18} />} radius="md">
        <Text size="sm">
          שדה ריק הוא תעריף שטרם הוגדר. אפשר לשמור את ההגדרות ולהשלים אותו
          בהמשך, אבל לא לשמור משמרת שדורשת אותו.
        </Text>
      </Alert>
    </Stack>
  );
}
