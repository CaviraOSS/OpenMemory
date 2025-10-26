import { useEffect, lazy, Suspense } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import "./App.css";

// Lazy load the Dashboard component
const Dashboard = lazy(() =>
  import("@/components/dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);

function App() {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

export default App;
