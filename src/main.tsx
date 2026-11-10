import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import { createTheme, DirectionProvider, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@fontsource/heebo/hebrew-400.css";
import "@fontsource/heebo/hebrew-500.css";
import "@fontsource/heebo/hebrew-600.css";
import "@fontsource/heebo/hebrew-700.css";
import "@fontsource/heebo/latin-400.css";
import "@fontsource/heebo/latin-600.css";
import "./styles.css";
import App, { FatalError } from "./App";
const theme = createTheme({
  fontFamily: "Heebo, Arial, sans-serif",
  primaryColor: "forest",
  colors: {
    forest: [
      "#eff7f3",
      "#deede6",
      "#bdd8cb",
      "#99c1ad",
      "#79ac94",
      "#649e84",
      "#508b71",
      "#40745d",
      "#315e4c",
      "#244e3e",
    ],
  },
  primaryShade: 8,
  defaultRadius: "md",
  headings: { fontFamily: "Heebo, Arial, sans-serif", fontWeight: "600" },
  components: {
    Button: { defaultProps: { radius: "md" } },
    Paper: { defaultProps: { radius: "lg" } },
    TextInput: { defaultProps: { size: "md" } },
    PasswordInput: { defaultProps: { size: "md" } },
    NumberInput: { defaultProps: { size: "md" } },
    Select: { defaultProps: { size: "md" } },
  },
});
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FatalError /> : this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DirectionProvider initialDirection="rtl">
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-center" />
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MantineProvider>
    </DirectionProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* App remains fully usable without install support. */
    });
  });
}
