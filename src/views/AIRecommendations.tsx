import { useMemo } from "react";
import { Award, ShieldAlert, UserPlus, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import {
  getTopPromotionRecommendations,
  getTopRetentionRecommendations,
  getTopCompensationAdjustments,
  getDepartmentHiringRecommendations,
} from "../utils/recommendations";
import { formatCurrency, formatNumber, formatPercent } from "../utils/format";

/** The color themes available for a recommendation section's icon badge. */
type Accent = "emerald" | "rose" | "amber" | "sky";

/** Tailwind class strings for each supported accent color. */
const ACCENT_CLASSES: Record<Accent, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400",
  rose: "bg-rose-500/10 text-rose-400",
  amber: "bg-amber-500/10 text-amber-400",
  sky: "bg-sky-500/10 text-sky-400",
};

/**
 * Card wrapper shared by all four recommendation lists: an icon, title, a
 * "Top N" count badge, a description, and a content slot for the list's table.
 *
 * @param title - string - the recommendation category's display name.
 * @param description - string - a one-line explanation of how the list is ranked/thresholded.
 * @param icon - LucideIcon - the icon shown in the accent-colored badge.
 * @param accent - Accent - which color theme the icon badge uses.
 * @param count - number - how many rows are actually being shown, displayed as "Top {count}".
 * @param children - React.ReactNode - the table (or other content) to render below the description.
 */
function SectionCard({
  title,
  description,
  icon: Icon,
  accent,
  count,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg p-1.5 ${ACCENT_CLASSES[accent]}`}>
            <Icon size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
          Top {count}
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-500">{description}</p>
      {children}
    </div>
  );
}

/**
 * A full-width placeholder table row shown when a recommendation list has no
 * matching rows.
 *
 * @param colSpan - number - how many columns the placeholder cell should span, matching the table's column count.
 * @param label - string - the message to display.
 */
function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}

/**
 * The AI Recommendations page: four ranked, actionable lists computed live
 * from the dataset — employees recommended for promotion, employees needing
 * retention plans, departments that need hiring due to excessive overtime,
 * and potential compensation adjustments. Every list is derived client-side
 * via the heuristics in `utils/recommendations.ts`; this component is purely
 * presentational.
 */
export function AIRecommendations() {
  const { filteredRecords, selectedMonth } = useHRData();

  const promotions = useMemo(() => getTopPromotionRecommendations(filteredRecords), [filteredRecords]);
  const retention = useMemo(() => getTopRetentionRecommendations(filteredRecords), [filteredRecords]);
  const hiring = useMemo(() => getDepartmentHiringRecommendations(filteredRecords), [filteredRecords]);
  const compAdjustments = useMemo(() => getTopCompensationAdjustments(filteredRecords), [filteredRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Ranked recommendations generated from {formatNumber(filteredRecords.length)} records &middot;{" "}
          {selectedMonth === "All" ? "All Months" : selectedMonth}
        </p>
      </div>

      <SectionCard
        title="Employees Recommended for Promotion"
        description="Promotion-eligible employees ranked by performance rating."
        icon={Award}
        accent="emerald"
        count={promotions.length}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">Employee</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Grade</th>
                <th className="py-2 pr-4 text-right font-medium">Rating</th>
                <th className="py-2 pr-4 text-right font-medium">Attrition Risk</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((r) => (
                <tr key={`${r.EmployeeID}-${r.Month}`} className="border-b border-slate-900 hover:bg-slate-900/40">
                  <td className="py-2 pr-4">
                    <div className="text-slate-200">{r.Name}</div>
                    <div className="text-xs text-slate-500">
                      {r.EmployeeID} &middot; {r.Month}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{r.Department}</td>
                  <td className="py-2 pr-4 text-slate-400">{r.Grade}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-200">
                    {r.PerformanceRating.toFixed(1)} / 5.0
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-400">{r.AttritionRiskScore} / 100</td>
                </tr>
              ))}
              {promotions.length === 0 && <EmptyRow colSpan={5} label="No promotion-eligible employees found." />}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Employees Requiring Retention Plans"
        description="High performers (rating 4.0+) with an elevated attrition risk score (60+), ranked by risk."
        icon={ShieldAlert}
        accent="rose"
        count={retention.length}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">Employee</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Grade</th>
                <th className="py-2 pr-4 text-right font-medium">Rating</th>
                <th className="py-2 pr-4 text-right font-medium">Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {retention.map((r) => (
                <tr key={`${r.EmployeeID}-${r.Month}`} className="border-b border-slate-900 hover:bg-slate-900/40">
                  <td className="py-2 pr-4">
                    <div className="text-slate-200">{r.Name}</div>
                    <div className="text-xs text-slate-500">
                      {r.EmployeeID} &middot; {r.Month}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{r.Department}</td>
                  <td className="py-2 pr-4 text-slate-400">{r.Grade}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-200">
                    {r.PerformanceRating.toFixed(1)} / 5.0
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-rose-400">{r.AttritionRiskScore} / 100</td>
                </tr>
              ))}
              {retention.length === 0 && (
                <EmptyRow colSpan={5} label="No employees currently flagged as retention risks." />
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Departments Requiring Hiring"
        description="Departments logging above-average overtime per employee — a signal that headcount hasn't kept pace with workload."
        icon={UserPlus}
        accent="amber"
        count={hiring.length}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 text-right font-medium">Headcount</th>
                <th className="py-2 pr-4 text-right font-medium">Avg OT Hrs / Employee</th>
                <th className="py-2 pr-4 text-right font-medium">Total OT Pay</th>
                <th className="py-2 pr-4 text-right font-medium">Employees w/ OT Spike</th>
                <th className="py-2 pr-4 text-right font-medium">Suggested Hires</th>
              </tr>
            </thead>
            <tbody>
              {hiring.map((d) => (
                <tr key={d.department} className="border-b border-slate-900 hover:bg-slate-900/40">
                  <td className="py-2 pr-4 text-slate-200">{d.department}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-400">{formatNumber(d.headcount)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-amber-400">
                    {d.avgOvertimeHours.toFixed(1)} hrs
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-400">
                    {formatCurrency(d.totalOvertimePay)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-400">{d.overtimeSpikeCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold text-emerald-400">
                    +{d.suggestedHires}
                  </td>
                </tr>
              ))}
              {hiring.length === 0 && (
                <EmptyRow colSpan={6} label="No department is currently running above-average overtime." />
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Potential Compensation Adjustments"
        description="Employees paid 15%+ below their grade's median salary, ranked by the size of the gap."
        icon={DollarSign}
        accent="sky"
        count={compAdjustments.length}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">Employee</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Grade</th>
                <th className="py-2 pr-4 text-right font-medium">Current Salary</th>
                <th className="py-2 pr-4 text-right font-medium">Grade Median</th>
                <th className="py-2 pr-4 text-right font-medium">% Below</th>
                <th className="py-2 pr-4 text-right font-medium">Suggested Adjustment</th>
              </tr>
            </thead>
            <tbody>
              {compAdjustments.map((r) => (
                <tr key={`${r.EmployeeID}-${r.Month}`} className="border-b border-slate-900 hover:bg-slate-900/40">
                  <td className="py-2 pr-4">
                    <div className="text-slate-200">{r.Name}</div>
                    <div className="text-xs text-slate-500">
                      {r.EmployeeID} &middot; {r.Month}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{r.Department}</td>
                  <td className="py-2 pr-4 text-slate-400">{r.Grade}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-200">
                    {formatCurrency(r.MonthlySalary)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-400">
                    {formatCurrency(r.gradeMedianSalary)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-sky-400">
                    {formatPercent(r.pctBelowMedian, 0)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold text-emerald-400">
                    +{formatCurrency(r.gradeMedianSalary - r.MonthlySalary)}
                  </td>
                </tr>
              ))}
              {compAdjustments.length === 0 && (
                <EmptyRow colSpan={7} label="No employees currently fall below their grade's median salary." />
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
