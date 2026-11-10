import {
  Alert,
  Code,
  List,
  Paper,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Cable, Check } from "lucide-react";
import { Brand } from "../components/Brand";
export default function Configuration({ message }: { message: string }) {
  return (
    <div className="configuration">
      <Brand />
      <Paper className="configuration-card" withBorder>
        <ThemeIcon size={56} radius={18} variant="light" color="teal">
          <Cable size={28} />
        </ThemeIcon>
        <Text className="eyebrow" mt="xl">
          עוד רגע מתחילים
        </Text>
        <Title order={1} mt={8}>
          הבית החדש למשמרות שלך.
        </Title>
        <Text c="dimmed" mt="md" size="lg">
          נשאר לחבר את PackTrack ל־Supabase כדי לשמור משמרות, להתחבר לחשבון
          ולחשב את השכר שלך.
        </Text>
        <Alert mt="xl" color="yellow" title="נדרשת הגדרה ראשונית">
          {message}
        </Alert>
        <List spacing="lg" mt="xl" icon={<Check size={18} />}>
          <List.Item>
            יוצרים פרויקט Supabase ומחילים את קובצי המיגרציה שבתיקיית{" "}
            <Code>supabase/migrations</Code>.
          </List.Item>
          <List.Item>
            מעתיקים את <Code>.env.example</Code> לקובץ <Code>.env.local</Code>{" "}
            ומוסיפים את כתובת הפרויקט והמפתח הציבורי.
          </List.Item>
          <List.Item>
            מגדירים כתובות חזרה לאימות ומפעילים מחדש את שרת הפיתוח.
          </List.Item>
        </List>
        <pre dir="ltr">
          VITE_SUPABASE_URL=https://your-project.supabase.co{"\n"}
          VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
        </pre>
        <Text size="sm" c="dimmed">
          הוראות מלאות נמצאות ב־README. עד לחיבור, נתוני חשבון ושכר אינם זמינים.
        </Text>
      </Paper>
      <Text c="dimmed" ta="center" size="sm" mt="xl">
        פחות התעסקות. יותר זמן באוויר.
      </Text>
    </div>
  );
}
