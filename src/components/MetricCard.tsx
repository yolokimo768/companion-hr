import type { LucideIcon } from "lucide-react";

/**
 * Props for `MetricCard`.
 *
 * - label: string - the small caption describing what the metric is (e.g. "Total Payroll").
 * - value: string - the large, already-formatted headline value to display (e.g. "$55.7M").
 * - icon: LucideIcon - the icon component shown in the accent-colored badge.
 * - accent: "indigo" | "emerald" | "amber" | "rose" | "sky" (optional, default "indigo") - which color theme the icon badge uses.
 * - subtext: string (optional) - a small line of additional context shown below the value (e.g. "6,250 records").
 */
interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  subtext?: string;
}

/** Tailwind class strings for each supported accent color. */
const ACCENTS: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  indigo: "bg-indigo-500/10 text-indigo-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  rose: "bg-rose-500/10 text-rose-400",
  sky: "bg-sky-500/10 text-sky-400",
};

/**
 * A small stat card showing one headline number with a label, an accent icon,
 * and optional supporting subtext. Used across the Payroll Dashboard for the
 * top-row summary metrics (Total Payroll, Total Overtime, Active Headcount,
 * Avg Attrition Risk).
 *
 * @param props - MetricCardProps - see `MetricCardProps` for each field's meaning.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "indigo",
  subtext,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-50 truncate">
          {value}
        </p>
        {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
      </div>
      <div className={`shrink-0 rounded-lg p-2.5 ${ACCENTS[accent]}`}>
        <Icon size={18} />
      </div>
    </div>
  );
}
