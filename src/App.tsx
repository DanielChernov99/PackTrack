import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Group,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import {
  BarChart3,
  CalendarDays,
  Home,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  WifiOff,
} from "lucide-react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { createServices, getConfigurationError } from "./data";
import type { AppServices, AuthSession } from "./data";
import type { Compensation } from "./domain";
import { AppContext } from "./app/context";
import { Brand } from "./components/Brand";
import { ErrorState, Loading, messageOf } from "./components/Common";
import AuthPage from "./pages/AuthPage";
import Configuration from "./pages/Configuration";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const History = lazy(() => import("./pages/History"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ShiftEditor = lazy(() => import("./pages/ShiftEditor"));
const navigation = [
  { to: "/", label: "הבית שלי", mobile: "בית", icon: Home },
  { to: "/shifts", label: "המשמרות שלי", mobile: "משמרות", icon: CalendarDays },
  { to: "/analytics", label: "תמונת מצב", mobile: "תובנות", icon: BarChart3 },
  { to: "/settings", label: "הפרופיל שלי", mobile: "פרופיל", icon: Settings },
];
function Shell({
  services,
  session,
}: {
  services: AppServices;
  session: AuthSession;
}) {
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const location = useLocation();
  const refreshCompensations = useCallback(async () => {
    const rows = await services.repository.getCompensationSettings();
    setCompensations(rows);
  }, [services]);
  const load = useCallback(() => {
    setError("");
    setLoaded(false);
    refreshCompensations()
      .then(() => setLoaded(true))
      .catch((e) => setError(messageOf(e)));
  }, [refreshCompensations]);
  useEffect(load, [load]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const email = session.user.email;
  return (
    <AppContext.Provider
      value={{
        ...services,
        user: session.user,
        compensations,
        refreshCompensations,
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand-link">
            <Brand />
          </Link>
          <Text className="nav-label">היומן שלך</Text>
          <nav className="desktop-nav" aria-label="ניווט ראשי">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"}>
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="note-sun">✳</div>
            <Text fw={600}>
              עבודה טובה מתחילה
              <br />
              בראש שקט.
            </Text>
            <Text size="xs" mt={8} c="dimmed">
              אתה דואג למצנחים.
              <br />
              אנחנו דואגים למספרים.
            </Text>
          </div>
          <div className="sidebar-account">
            <Avatar color="teal" radius="xl">
              {email.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text size="sm" fw={600}>
                החשבון שלי
              </Text>
              <Text size="xs" c="dimmed" className="account-email" dir="ltr">
                {email}
              </Text>
            </div>
            <button
              className="icon-button"
              aria-label="התנתקות"
              onClick={() => {
                services.auth.signOut().catch((e) => setError(messageOf(e)));
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <span className="topbar-label">המרחב שלך. בקצב שלך.</span>
            <Link to="/" className="mobile-brand">
              <Brand />
            </Link>
            <Group gap={16}>
              <span className="cloud-status">
                <i className="status-dot" />
                מחובר לחשבון
              </span>
              <button
                className="icon-button theme-button"
                aria-label="החלף מצב תצוגה"
                onClick={toggleColorScheme}
              >
                {colorScheme === "dark" ? (
                  <Sun size={19} />
                ) : (
                  <Moon size={19} />
                )}
              </button>
            </Group>
          </header>
          <main className="page-content" id="main-content">
            {!online && (
              <Alert color="yellow" icon={<WifiOff size={20} />} mb="lg">
                אין חיבור לאינטרנט. שמירה וטעינת נתונים דורשות חיבור פעיל.
              </Alert>
            )}
            {error ? (
              <ErrorState message={error} retry={load} />
            ) : !loaded ? (
              <Loading />
            ) : (
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/shifts" element={<History />} />
                  <Route
                    path="/shifts/new"
                    element={<ShiftEditor key={location.pathname} />}
                  />
                  <Route
                    path="/shifts/:id"
                    element={<ShiftEditor key={location.pathname} />}
                  />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/auth/callback"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/auth/reset"
                    element={<Navigate to="/" replace />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            )}
          </main>
        </div>
        <nav className="bottom-nav" aria-label="ניווט בנייד">
          {navigation.map(({ to, mobile, icon: Icon }, i) => (
            <div key={to} className="bottom-item">
              {i === 2 && (
                <Link
                  className="mobile-add"
                  to="/shifts/new"
                  aria-label="הוסף משמרת"
                >
                  <Plus size={25} />
                </Link>
              )}
              <NavLink to={to} end={to === "/"}>
                <Icon size={21} />
                <span>{mobile}</span>
              </NavLink>
            </div>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
function Connected({ services }: { services: AppServices }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(
    () => window.location.pathname === "/auth/reset",
  );
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const stop = services.auth.onAuthStateChange((event, next) => {
      receivedEvent = true;
      if (active) {
        setSession(next);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
      }
    });
    services.auth
      .getSession()
      .then((value) => {
        if (active && !receivedEvent) setSession(value);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      stop();
    };
  }, [services]);
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="configuration">
        <ErrorState message={error} retry={() => window.location.assign("/")} />
      </div>
    );
  if (recovery && session)
    return (
      <AuthPage
        auth={services.auth}
        recovery
        onRecovered={() => {
          setRecovery(false);
          navigate("/", { replace: true });
        }}
      />
    );
  if (!session) return <AuthPage auth={services.auth} />;
  return <Shell key={session.user.id} services={services} session={session} />;
}
// One runtime client avoids duplicate auth subscriptions under React StrictMode.
let runtimeServices: AppServices | null | undefined;
function configuredServices() {
  if (runtimeServices === undefined)
    runtimeServices = getConfigurationError() ? null : createServices();
  return runtimeServices;
}
export default function App({
  services: provided,
}: {
  services?: AppServices;
}) {
  const [services] = useState(() => provided ?? configuredServices());
  if (!services)
    return (
      <Configuration
        message={getConfigurationError() ?? "יש לבדוק את הגדרות Supabase"}
      />
    );
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        דלג לתוכן
      </a>
      <Connected services={services} />
    </BrowserRouter>
  );
}
export function FatalError() {
  return (
    <div className="configuration">
      <ErrorState
        message="משהו השתבש בהצגת המסך. הנתונים השמורים שלך לא השתנו."
        retry={() => window.location.reload()}
      />
      <Button mt="md" component="a" href="/">
        חזרה לבית
      </Button>
    </div>
  );
}
