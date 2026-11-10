import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Text,
  Title,
} from "@mantine/core";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Plus,
  Wind,
} from "lucide-react";
import { Link } from "react-router-dom";
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <Text className="eyebrow">המרחב האישי שלך</Text>
        <Title order={1}>{title}</Title>
        <Text c="dimmed" mt={6}>
          {subtitle}
        </Text>
      </div>
      {action}
    </div>
  );
}
export function AddShift() {
  return (
    <Button
      component={Link}
      to="/shifts/new"
      leftSection={<Plus size={19} />}
      size="md"
    >
      הוסף משמרת
    </Button>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <Loader color="teal" />
      <Text c="dimmed">רק רגע, טוענים את הנתונים שלך…</Text>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Alert
      color="red"
      title="לא הצלחנו לטעון את הנתונים"
      icon={<CloudOff size={20} />}
    >
      <Text size="sm">{message}</Text>
      {retry && (
        <Button mt="sm" variant="light" color="red" onClick={retry}>
          נסה שוב
        </Button>
      )}
    </Alert>
  );
}
export function EmptyState({
  title = "כאן מתחילה המשמרת הבאה שלך",
  description = "בסוף יום במועדון, מוסיפים משמרת. אנחנו נדאג לחישוב.",
  action = true,
}: {
  title?: string;
  description?: string;
  action?: boolean;
}) {
  return (
    <Paper className="empty-state" withBorder>
      <div className="empty-icon">
        <Wind size={30} />
      </div>
      <Title order={3}>{title}</Title>
      <Text c="dimmed" maw={360} mx="auto" mt={8} mb={24}>
        {description}
      </Text>
      {action && <AddShift />}
    </Paper>
  );
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-15T12:00:00Z"));
}
export function moveMonth(month: string, delta: number) {
  const date = new Date(month + "-15T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Group gap={8} className="month-picker">
      <ActionIcon
        variant="subtle"
        aria-label="החודש הקודם"
        onClick={() => onChange(moveMonth(value, -1))}
      >
        <ChevronRight size={18} />
      </ActionIcon>
      <label className="month-label">
        <span>{monthLabel(value)}</span>
        <input
          aria-label="בחירת חודש ושנה"
          type="month"
          value={value}
          min="1900-01"
          max="2100-12"
          onChange={(e) => {
            if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
          }}
        />
      </label>
      <ActionIcon
        variant="subtle"
        aria-label="החודש הבא"
        onClick={() => onChange(moveMonth(value, 1))}
      >
        <ChevronLeft size={18} />
      </ActionIcon>
    </Group>
  );
}
export function AllShiftsLink() {
  return (
    <Button
      component={Link}
      to="/shifts"
      variant="subtle"
      rightSection={<ArrowLeft size={16} />}
    >
      לכל המשמרות
    </Button>
  );
}
export function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "אירעה שגיאה. כדאי לנסות שוב.";
}
