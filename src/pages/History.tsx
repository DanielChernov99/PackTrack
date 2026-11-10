import { useState } from "react";
import { Badge, Button, Group, Modal, Paper, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Trash2 } from "lucide-react";
import { useShifts } from "../app/hooks";
import { useApp } from "../app/context";
import { monthInJerusalem, money, summarizeShifts } from "../domain";
import type { Shift } from "../domain";
import {
  AddShift,
  EmptyState,
  ErrorState,
  Loading,
  messageOf,
  MonthPicker,
  moveMonth,
  PageHeading,
} from "../components/Common";
import { ShiftRow } from "./Dashboard";
export default function History() {
  const [month, setMonth] = useState(monthInJerusalem());
  const { repository } = useApp();
  const { data, loading, error, reload } = useShifts(
    month + "-01",
    moveMonth(month, 1) + "-01",
  );
  const [deleting, setDeleting] = useState<Shift | null>(null);
  const [busy, setBusy] = useState(false);
  const summary = summarizeShifts(data);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await repository.deleteShift(deleting.id, deleting.version);
      setDeleting(null);
      reload();
      notifications.show({
        title: "המשמרת נמחקה",
        message: "הסיכום החודשי עודכן.",
        color: "teal",
      });
    } catch (e) {
      notifications.show({ message: messageOf(e), color: "red" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="המשמרות שלי"
        subtitle="כל יום במועדון, עם כל הפרטים הקטנים."
        action={<AddShift />}
      />
      <div className="section-heading">
        <Group>
          <Title order={3}>יומן המשמרות</Title>
          <Badge variant="light">{data.length} משמרות</Badge>
        </Group>
        <MonthPicker value={month} onChange={setMonth} />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <>
          <Paper className="history-summary" withBorder>
            <div>
              <Text size="sm" c="dimmed">
                הכנסה משוערת
              </Text>
              <strong>
                <bdi>{money(summary.total)}</bdi>
              </strong>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                שעות לתשלום
              </Text>
              <strong>
                {(summary.paidMinutes / 60).toLocaleString("he-IL", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                מצנחים
              </Text>
              <strong>{summary.count}</strong>
            </div>
          </Paper>
          {data.length ? (
            <Paper className="shifts-list" withBorder>
              {data.map((shift) => (
                <div className="history-row" key={shift.id}>
                  <ShiftRow shift={shift} />
                  <Button
                    variant="subtle"
                    color="gray"
                    size="compact-sm"
                    aria-label={"מחק משמרת " + shift.workDate}
                    onClick={() => setDeleting(shift)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              ))}
            </Paper>
          ) : (
            <EmptyState
              title="אין משמרות בחודש הזה"
              description="אפשר לעבור לחודש אחר, או להוסיף את המשמרת הראשונה."
            />
          )}
        </>
      )}
      <Modal
        opened={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title="למחוק את המשמרת?"
        centered
      >
        <Text c="dimmed">
          המשמרת מתאריך {deleting?.workDate} וכל הבונוסים שלה יימחקו. אין אפשרות
          לבטל את המחיקה.
        </Text>
        <Group mt="xl" justify="flex-end">
          <Button
            variant="default"
            onClick={() => setDeleting(null)}
            disabled={busy}
          >
            ביטול
          </Button>
          <Button color="red" onClick={remove} loading={busy}>
            מחק משמרת
          </Button>
        </Group>
      </Modal>
    </>
  );
}
