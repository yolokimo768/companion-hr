import { useState } from "react";
import { HRDataProvider, useHRData } from "./hooks/useHRData";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { PayrollDashboard } from "./views/PayrollDashboard";
import { EmployeeSearch } from "./views/EmployeeSearch";
import { ScenarioSimulator } from "./views/ScenarioSimulator";
import { ExecutiveSummary } from "./views/ExecutiveSummary";
import { AIChatAssistant } from "./views/AIChatAssistant";
import { AIRecommendations } from "./views/AIRecommendations";
import { Loader2, AlertTriangle } from "lucide-react";

/** Identifier for each of the app's 6 top-level views, matching the keys used by `Sidebar`'s `NAV_ITEMS`. */
export type TabKey = "dashboard" | "search" | "simulator" | "insights" | "recommendations" | "chat";

/** Page title/subtitle text shown in the `Header`, keyed by `TabKey`. */
const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Payroll Dashboard",
    subtitle: "Company-wide compensation and overtime overview",
  },
  search: {
    title: "Employee Search & Profiles",
    subtitle: "Search, filter, and inspect individual employee records",
  },
  simulator: {
    title: "Scenario Simulator",
    subtitle: "Model the fiscal impact of compensation policy changes",
  },
  insights: {
    title: "Executive Summary",
    subtitle: "Automated, rule-based insights across the workforce",
  },
  recommendations: {
    title: "AI Recommendations",
    subtitle: "Ranked, actionable recommendations across the workforce",
  },
  chat: {
    title: "AI HR Assistant",
    subtitle: "Ask questions about the dataset in plain language",
  },
};

/**
 * The app's overall layout and view router: renders the sidebar, header, and
 * whichever view matches the currently-selected tab, plus the global
 * loading/error states surfaced by `useHRData` while the CSV dataset is
 * being parsed.
 */
function AppShell() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loading, error, records } = useHRData();
  const meta = TAB_META[tab];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar
        active={tab}
        onSelect={setTab}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {loading && records.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Parsing dataset client-side&hellip;</p>
            </div>
          ) : (
            <>
              {tab === "dashboard" && <PayrollDashboard />}
              {tab === "search" && <EmployeeSearch />}
              {tab === "simulator" && <ScenarioSimulator />}
              {tab === "insights" && <ExecutiveSummary />}
              {tab === "recommendations" && <AIRecommendations />}
              {tab === "chat" && <AIChatAssistant />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * The application root: wraps `AppShell` in `HRDataProvider` so every view
 * and component below it can call `useHRData()` to access the dataset.
 */
function App() {
  return (
    <HRDataProvider>
      <AppShell />
    </HRDataProvider>
  );
}

export default App;
