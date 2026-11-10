import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Text,
  Title,
} from "@mantine/core";
import {
  ArrowUpLeft,
  CalendarDays,
  Clock3,
  Layers,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../app/context";
import { useShifts } from "../app/hooks";
import {
  earningsForShift,
  money,
  monthInJerusalem,
  roleLabels,
  selectCompensation,
  summarizeShifts,
  todayInJerusalem,
} from "../domain";
import type { Shift } from "../domain";
import {
  AddShift,
  AllShiftsLink,
  EmptyState,
  ErrorState,
  Loading,
  MonthPicker,
  moveMonth,
  PageHeading,
} from "../components/Common";
export function ShiftRow({ shift }: { shift: Shift }) {
  const pay = earningsForShift(shift);
  const date = new Date(shift.workDate + "T12:00:00Z");
  return (
    <Link to={"/shifts/" + shift.id} className="shift-row">
      <div className="date-tile">
        <strong>{date.getUTCDate()}</strong>
        <span>
          {new Intl.DateTimeFormat("he-IL", {
            month: "short",
            timeZone: "UTC",
          }).format(date)}
        </span>
      </div>
      <div className="shift-row-main">
        <Text fw={600}>
          {new Intl.DateTimeFormat("he-IL", {
            weekday: "long",
            timeZone: "UTC",
          }).format(date)}
        </Text>
        <Text c="dimmed" size="sm">
          <bdi>
            {shift.startTime}–{shift.endTime}
          </bdi>
          <span className="dot">·</span>
          {pay.count} מצנחים
        </Text>
      </div>
      <div className="shift-row-pay">
        <strong dir="ltr">{money(pay.total)}</strong>
        <Text c="dimmed" size="xs">
          {((pay.paidMinutes + pay.creditedMinutes) / 60).toLocaleString(
            "he-IL",
            { maximumFractionDigits: 2 },
          )}{" "}
          שעות לתשלום
        </Text>
      </div>
      <ArrowUpLeft size={18} className="muted-icon" />
    </Link>
  );
}
export default function Dashboard() {
  const [month, setMonth] = useState(monthInJerusalem());
  const { compensations } = useApp();
  const { data, loading, error, reload } = useShifts(
    month + "-01",
    moveMonth(month, 1) + "-01",
  );
  const current = selectCompensation(compensations, todayInJerusalem());
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const summary = summarizeShifts(data);
  const breakdown = [
    { label: "שכר שעתי", value: summary.hourly, color: "#bfe882" },
    { label: "קיפול מצנחים", value: summary.pieces, color: "#6db4a2" },
    { label: "בונוסים ותיקונים", value: summary.bonuses, color: "#f0be77" },
  ];
  return (
    <>
      <PageHeading
        title="יום טוב, נחיתה רכה."
        subtitle="כל המשמרות, הקיפולים וההכנסות שלך. במקום אחד."
        action={<AddShift />}
      />
      <div className="section-heading">
        <Group gap="sm">
          <Title order={3}>המבט החודשי שלך</Title>
          {current && (
            <Badge variant="light" color="teal">
              {roleLabels[current.role]}
            </Badge>
          )}
        </Group>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {(!current || current.hourlyRate === null) && (
        <Paper className="setup-nudge" mb="lg">
          <Sparkles size={20} />
          <div>
            <Text fw={600}>נגדיר את התעריף שלך?</Text>
            <Text size="sm" c="dimmed">
              עוד צעד קטן לפני שמתחילים לחשב את השכר.
            </Text>
          </div>
          <Button component={Link} to="/settings" variant="light" size="sm">
            להגדרות שכר
          </Button>
        </Paper>
      )}
      <div className="overview-grid">
        <Paper className="earnings-card">
          <div className="hero-top">
            <span>
              <Wallet size={18} /> ההכנסה החודשית שלך
            </span>
            <span className="hero-chip">ברוטו משוער</span>
          </div>
          <div className="hero-total" dir="ltr">
            {money(summary.total)}
          </div>
          <Text className="hero-caption">כל שעה וכל קיפול עושים את ההבדל.</Text>
          <div className="hero-breakdown">
            {breakdown.map((item) => (
              <div key={item.label}>
                <span>
                  <i style={{ background: item.color }} />
                  {item.label}
                </span>
                <strong dir="ltr">{money(item.value)}</strong>
              </div>
            ))}
          </div>
          <svg className="hero-canopy" viewBox="0 0 200 190" aria-hidden="true">
            <path d="M10 95a90 90 0 0 1 180 0M10 95q30-35 60 0 30-35 60 0 30-35 60 0M10 95l90 85 90-85M70 95l30 85 30-85M70 95q-8-70 30-90 38 20 30 90" />
          </svg>
        </Paper>
        <div className="stat-stack">
          <Paper className="stat-card">
            <div className="stat-icon mint">
              <Clock3 size={22} />
            </div>
            <div>
              <Text c="dimmed" size="sm">
                שעות לתשלום
              </Text>
              <strong>
                {(summary.paidMinutes / 60).toLocaleString("he-IL", {
                  maximumFractionDigits: 2,
                })}
                <small> שעות</small>
              </strong>
            </div>
          </Paper>
          <Paper className="stat-card">
            <div className="stat-icon sand">
              <Layers size={22} />
            </div>
            <div>
              <Text c="dimmed" size="sm">
                מצנחים שקופלו
              </Text>
              <strong>
                {summary.count.toLocaleString("he-IL")}
                <small> מצנחים</small>
              </strong>
            </div>
          </Paper>
          <Paper className="stat-card">
            <div className="stat-icon lilac">
              <CalendarDays size={22} />
            </div>
            <div>
              <Text c="dimmed" size="sm">
                משמרות שהושלמו
              </Text>
              <strong>
                {data.length}
                <small> משמרות</small>
              </strong>
            </div>
          </Paper>
        </div>
      </div>
      <div className="dashboard-lower">
        <section>
          <div className="section-heading">
            <Title order={3}>המשמרות האחרונות</Title>
            <AllShiftsLink />
          </div>
          {data.length ? (
            <Paper className="shifts-list" withBorder>
              {data.slice(0, 4).map((shift) => (
                <ShiftRow key={shift.id} shift={shift} />
              ))}
            </Paper>
          ) : (
            <EmptyState />
          )}
        </section>
        <section>
          <div className="section-heading">
            <Title order={3}>מאיפה מגיע השכר?</Title>
            <span className="muted-icon">
              <Sparkles size={18} />
            </span>
          </div>
          <Paper className="breakdown-card" withBorder>
            <Text c="dimmed" size="sm" mb="xl">
              החלוקה של ההכנסה החודשית
            </Text>
            {breakdown.map((item) => (
              <div className="breakdown-line" key={item.label}>
                <Group justify="space-between" mb={9}>
                  <Text size="sm">{item.label}</Text>
                  <Text size="sm" fw={600}>
                    <bdi>{money(item.value)}</bdi>
                  </Text>
                </Group>
                <Progress
                  value={
                    (Math.max(0, item.value) /
                      Math.max(
                        1,
                        summary.hourly +
                          summary.pieces +
                          Math.max(0, summary.bonuses),
                      )) *
                    100
                  }
                  color={item.color}
                  size={7}
                />
              </div>
            ))}
            <Text size="xs" c="dimmed" mt="xl">
              הסכומים הם הערכת שכר ברוטו, לפני ניכויים.
            </Text>
          </Paper>
        </section>
      </div>
      <div className="quiet-footer">
        <span className="status-dot" /> הנתונים שלך, מסודרים ובמקום אחד.
        <span>PACK. TRACK. REPEAT.</span>
      </div>
    </>
  );
}
