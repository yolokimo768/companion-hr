import {
  LayoutDashboard,
  Users,
  SlidersHorizontal,
  Lightbulb,
  MessageSquare,
  Sparkles,
  BrainCircuit,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TabKey } from "../App";

/**
 * One entry in the sidebar navigation list.
 *
 * - key: TabKey - the tab identifier this entry activates when clicked.
 * - label: string - the display text shown next to the icon.
 * - icon: LucideIcon - the icon component shown for this entry.
 */
interface NavItem {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

/** The fixed, ordered list of every tab shown in the sidebar. */
const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Payroll Dashboard", icon: LayoutDashboard },
  { key: "search", label: "Employee Search", icon: Users },
  { key: "simulator", label: "Scenario Simulator", icon: SlidersHorizontal },
  { key: "insights", label: "Executive Summary", icon: Lightbulb },
  { key: "recommendations", label: "AI Recommendations", icon: BrainCircuit },
  { key: "chat", label: "AI HR Assistant", icon: MessageSquare },
];

/**
 * Props for `Sidebar`.
 *
 * - active: TabKey - which tab is currently selected, used to highlight the matching nav entry.
 * - onSelect: (tab: TabKey) => void - callback fired when the user clicks a nav entry.
 * - mobileOpen: boolean - whether the sidebar's mobile (off-canvas) presentation is currently open.
 * - onCloseMobile: () => void - callback fired to close the mobile sidebar (backdrop click, close button, or after selecting a tab).
 */
interface SidebarProps {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * The app's left-hand navigation: the CompanionHR brand header, the list of
 * view tabs from `NAV_ITEMS`, and a footer note. On small screens it renders
 * as an off-canvas drawer controlled by `mobileOpen`/`onCloseMobile`; on large
 * screens it's always visible as a static column.
 *
 * @param props - SidebarProps - see `SidebarProps` for each field's meaning.
 */
export function Sidebar({ active, onSelect, mobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
              <Sparkles size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-50">CompanionHR</p>
              <p className="text-[10px] text-slate-500">Compensation Assistant</p>
            </div>
          </div>
          <button
            className="lg:hidden text-slate-500 hover:text-slate-200"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 text-[11px] text-slate-600">
          25k rows processed 100% client-side.
        </div>
      </aside>
    </>
  );
}
