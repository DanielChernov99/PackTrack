import { useState } from "react";
import {
  ActionIcon,
  Group,
  Paper,
  SegmentedControl,
  Text,
  Title,
} from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useShifts } from "../app/hooks";
import { money, monthInJerusalem, summarizeShifts } from "../domain";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeading,
} from "../components/Common";
export default function Analytics() {
  const [year, setYear] = useState(Number(monthInJerusalem().slice(0, 4)));
  const [metric, setMetric] = useState("earnings");
  const { data, loading, error, reload } = useShifts(
    year + "-01-01",
    year + 1 + "-01-01",
  );
  const rows = Array.from({ length: 12 }, (_, i) => {
    const key = year + "-" + String(i + 1).padStart(2, "0");
    const s = summarizeShifts(data.filter((x) => x.workDate.startsWith(key)));
    return {
      name: new Intl.DateTimeFormat("he-IL", {
        month: "short",
        timeZone: "UTC",
      }).format(new Date(key + "-15T12:00:00Z")),
      earnings: s.total / 100,
      hours: Number((s.paidMinutes / 60).toFixed(2)),
      parachutes: s.count,
      hourly: s.hourly / 100,
      pieces: s.pieces / 100,
      bonuses: s.bonuses / 100,
    };
  });
  const summary = summarizeShifts(data);
  return (
    <>
      <PageHeading
        title="התמונה הגדולה"
        subtitle="רגע להסתכל על הדרך שעשית, חודש אחרי חודש."
      />
      <div className="section-heading">
        <Title order={3}>השנה שלך במספרים</Title>
        <Group gap="xs">
          <ActionIcon
            aria-label="השנה הקודמת"
            variant="subtle"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronRight size={18} />
          </ActionIcon>
          <Text fw={600}>{year}</Text>
          <ActionIcon
            aria-label="השנה הבאה"
            variant="subtle"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronLeft size={18} />
          </ActionIcon>
        </Group>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <>
          <Paper className="history-summary" withBorder>
            <div>
              <Text c="dimmed" size="sm">
                ברוטו שנתי משוער
              </Text>
              <strong>
                <bdi>{money(summary.total)}</bdi>
              </strong>
            </div>
            <div>
              <Text c="dimmed" size="sm">
                שעות לתשלום
              </Text>
              <strong>
                {(summary.paidMinutes / 60).toLocaleString("he-IL", {
                  maximumFractionDigits: 1,
                })}
              </strong>
            </div>
            <div>
              <Text c="dimmed" size="sm">
                מצנחים שקופלו
              </Text>
              <strong>{summary.count}</strong>
            </div>
          </Paper>
          {data.length ? (
            <>
              <Paper className="chart-card" withBorder>
                <Group justify="space-between" mb="xl">
                  <Title order={3}>הקצב החודשי שלך</Title>
                  <SegmentedControl
                    value={metric}
                    onChange={setMetric}
                    data={[
                      { value: "earnings", label: "הכנסות" },
                      { value: "hours", label: "שעות" },
                      { value: "parachutes", label: "מצנחים" },
                    ]}
                  />
                </Group>
                <div
                  className="chart-wrap"
                  dir="ltr"
                  role="img"
                  aria-label="תרשים חודשי לפי המדד הנבחר"
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={rows}
                      margin={{ left: 0, right: 16, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="4 6"
                        stroke="var(--chart-grid)"
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        width={55}
                      />
                      <Tooltip
                        formatter={(value) =>
                          metric === "earnings"
                            ? money(Number(value) * 100)
                            : String(value)
                        }
                        contentStyle={{
                          borderRadius: 12,
                          direction: "rtl",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey={metric}
                        name={
                          metric === "earnings"
                            ? "הכנסות"
                            : metric === "hours"
                              ? "שעות"
                              : "מצנחים"
                        }
                        fill="#5c9c88"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={38}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
              <Paper className="chart-card" withBorder mt="lg">
                <Title order={3} mb="lg">
                  ממה מורכב השכר
                </Title>
                <Group gap="lg" mb="lg">
                  {[
                    ["#315e50", "שכר שעתי"],
                    ["#acd16f", "קיפול מצנחים"],
                    ["#e9bc79", "בונוסים ותיקונים"],
                  ].map(([color, label]) => (
                    <Text size="sm" key={label}>
                      <i className="legend-dot" style={{ background: color }} />
                      {label}
                    </Text>
                  ))}
                </Group>
                <div dir="ltr" role="img" aria-label="פירוט שכר חודשי">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={rows}>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="4 6"
                        stroke="var(--chart-grid)"
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip
                        formatter={(value) => money(Number(value) * 100)}
                        contentStyle={{
                          borderRadius: 12,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey="hourly"
                        name="שכר שעתי"
                        stackId="pay"
                        fill="#315e50"
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey="pieces"
                        name="קיפול מצנחים"
                        stackId="pay"
                        fill="#acd16f"
                      />
                      <Bar
                        isAnimationActive={false}
                        dataKey="bonuses"
                        name="בונוסים ותיקונים"
                        stackId="pay"
                        fill="#e9bc79"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Paper>
              <details className="accessible-data">
                <summary>הצג נתונים בטבלה</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>חודש</th>
                        <th>ברוטו משוער</th>
                        <th>שעות</th>
                        <th>מצנחים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{money(row.earnings * 100)}</td>
                          <td>{row.hours}</td>
                          <td>{row.parachutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <EmptyState
              title="התמונה תתמלא, משמרת אחרי משמרת"
              description="אחרי שמוסיפים משמרות, אפשר לראות כאן את ההכנסות והפעילות לאורך השנה."
            />
          )}
        </>
      )}
    </>
  );
}
