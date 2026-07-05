import { useMemo, useState } from "react";
import {
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Award,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import { departmentBreakdown } from "../utils/aggregate";
import {
  getOvertimeSpikeEmployees,
  getOvertimeSpikesByDepartment,
  getOvertimeTrend,
  getLowCompensationEmployees,
  getLowCompensationTrend,
  getRetentionRiskEmployees,
  getRetentionRiskTrend,
  getPromotionCandidates,
  getPromotionCandidateTrend,
  getHighAttritionRiskEmployees,
  getHighAttritionRiskTrend,
  type LowCompEmployee,
} from "../utils/categories";
import { buildNarrativeSummary } from "../utils/narrativeSummary";
import { formatCurrency, formatNumber, formatPercent } from "../utils/format";
import { GRADES, type Department, type Grade, type HRRecord } from "../types";

/** Which of the 5 insight categories (if any) is currently drilled into. `null` means the overview grid is shown. */
type CategoryKey = "overtime" | "lowComp" | "retention" | "promotion" | "attrition";

/** The color themes available for an insight card's icon badge. */
type Accent = "amber" | "sky" | "rose" | "emerald";

/** Tailwind class strings for each supported accent color. */
const ACCENT_CLASSES: Record<Accent, string> = {
  amber: "bg-amber-500/10 text-amber-400",
  sky: "bg-sky-500/10 text-sky-400",
  rose: "bg-rose-500/10 text-rose-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
};

/**
 * Describes one column of a generic `DataTable`.
 *
 * - header: string - the column's header text.
 * - align: "right" (optional) - right-aligns the header and cell content (used for numeric columns).
 * - render: (row: T) => React.ReactNode - produces the cell content for a given row.
 */
interface ColumnDef<T> {
  header: string;
  align?: "right";
  render: (row: T) => React.ReactNode;
}

/**
 * A generic, reusable table renderer shared by every category detail page:
 * takes a list of rows and a column-definition array and renders a styled
 * `<table>`, showing `emptyLabel` in place of the body when `rows` is empty.
 *
 * @param rows - T[] - the records to render, one per table row. Each row must have EmployeeID/Month so a stable React key can be derived.
 * @param columns - ColumnDef<T>[] - the columns to render, in order.
 * @param emptyLabel - string - message shown instead of rows when `rows` is empty.
 */
function DataTable<T extends { EmployeeID: string; Month: string }>({
  rows,
  columns,
  emptyLabel,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
            {columns.map((c) => (
              <th
                key={c.header}
                className={`py-2 pr-4 font-medium ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.EmployeeID}-${row.Month}`}
              className="border-b border-slate-900 hover:bg-slate-900/40"
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={`py-2 pr-4 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center text-sm text-slate-500">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Shared page chrome for every category drill-down view: a "Back to
 * Insights" button, a title/description header, and a content slot.
 *
 * @param title - string - the category's display name.
 * @param description - string - a one-line explanation of how the category is defined/thresholded.
 * @param onBack - () => void - callback fired when the back button is clicked (returns to the overview grid).
 * @param children - React.ReactNode - the category-specific content (trend banner, filters, table) to render below the header.
 */
function DetailPage({
  title,
  description,
  onBack,
  children,
}: {
  title: string;
  description: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft size={15} /> Back to Insights
      </button>
      <div>
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * A single toggle-style filter chip (e.g. a grade filter on the Low
 * Compensation page), styled differently when active.
 *
 * @param label - string - the text shown on the pill.
 * @param active - boolean - whether this pill represents the currently-selected filter value.
 * @param onClick - () => void - callback fired when the pill is clicked.
 */
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
        active
          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
          : "border-slate-700 text-slate-400 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * A colored callout banner showing a month-over-month percentage change,
 * with an up/down trend arrow. Color (emerald vs. rose) is driven by
 * `favorable` rather than the sign of `pctChange`, since for some categories
 * (e.g. Promotion Candidates) an increase is the desired outcome while for
 * others (e.g. Overtime Spikes) a decrease is.
 *
 * @param pctChange - number - the percentage change to display (its sign picks the up/down arrow icon).
 * @param favorable - boolean - whether this particular change is a good outcome for this category, controlling the banner's color.
 * @param children - React.ReactNode - the sentence describing the change, rendered next to the arrow icon.
 */
function TrendBanner({
  pctChange,
  favorable,
  children,
}: {
  pctChange: number;
  favorable: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm ${
        favorable
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          : "border-rose-500/30 bg-rose-500/5 text-rose-300"
      }`}
    >
      {pctChange >= 0 ? (
        <TrendingUp size={16} className="shrink-0" />
      ) : (
        <TrendingDown size={16} className="shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

/** Shared "Name" column definition (name + ID/month subtext), reused across every category's DataTable. */
const nameCol: ColumnDef<HRRecord> = {
  header: "Name",
  render: (r) => (
    <div>
      <div className="text-slate-200">{r.Name}</div>
      <div className="text-xs text-slate-500">{r.EmployeeID} &middot; {r.Month}</div>
    </div>
  ),
};
/** Shared "Department" column definition, reused across every category's DataTable. */
const deptCol: ColumnDef<HRRecord> = { header: "Department", render: (r) => <span className="text-slate-400">{r.Department}</span> };
/** Shared "Grade" column definition, reused across every category's DataTable. */
const gradeCol: ColumnDef<HRRecord> = { header: "Grade", render: (r) => <span className="text-slate-400">{r.Grade}</span> };

/**
 * The Executive Summary / Insights Engine page: an overview grid of 5
 * clickable automated-insight cards (Overtime Spikes, Low Compensation,
 * Retention Risk, Promotion Candidates, High Attrition Risk), each of which
 * drills into its own detail page with a trend banner, optional filters, and
 * a data table. The overview also shows a per-department snapshot table and
 * the generated "AI HR Summary" narrative. All category logic is delegated
 * to `utils/categories.ts`; this component is purely presentational/routing.
 */
export function ExecutiveSummary() {
  const { filteredRecords, records, selectedMonth } = useHRData();
  const [active, setActive] = useState<CategoryKey | null>(null);
  const [gradeFilter, setGradeFilter] = useState<Grade | "All">("All");
  const [overtimeDeptFilter, setOvertimeDeptFilter] = useState<Department | "All">("All");

  const overtimeEmployees = useMemo(
    () => getOvertimeSpikeEmployees(filteredRecords),
    [filteredRecords]
  );
  const overtimeByDept = useMemo(
    () => getOvertimeSpikesByDepartment(filteredRecords),
    [filteredRecords]
  );
  const overtimeFiltered = useMemo(
    () =>
      overtimeDeptFilter === "All"
        ? overtimeEmployees
        : overtimeEmployees.filter((e) => e.Department === overtimeDeptFilter),
    [overtimeEmployees, overtimeDeptFilter]
  );
  const overtimeTrend = useMemo(
    () =>
      selectedMonth === "All"
        ? null
        : getOvertimeTrend(records, overtimeDeptFilter, selectedMonth),
    [records, overtimeDeptFilter, selectedMonth]
  );
  const lowCompEmployees = useMemo(
    () => getLowCompensationEmployees(filteredRecords),
    [filteredRecords]
  );
  const lowCompFiltered = useMemo(
    () =>
      gradeFilter === "All"
        ? lowCompEmployees
        : lowCompEmployees.filter((e) => e.Grade === gradeFilter),
    [lowCompEmployees, gradeFilter]
  );
  const lowCompTrend = useMemo(
    () =>
      selectedMonth === "All"
        ? null
        : getLowCompensationTrend(records, selectedMonth, gradeFilter),
    [records, selectedMonth, gradeFilter]
  );
  const retentionRiskEmployees = useMemo(
    () => getRetentionRiskEmployees(filteredRecords),
    [filteredRecords]
  );
  const retentionTrend = useMemo(
    () => (selectedMonth === "All" ? null : getRetentionRiskTrend(records, selectedMonth)),
    [records, selectedMonth]
  );
  const promotionCandidates = useMemo(
    () => getPromotionCandidates(filteredRecords),
    [filteredRecords]
  );
  const promotionTrend = useMemo(
    () => (selectedMonth === "All" ? null : getPromotionCandidateTrend(records, selectedMonth)),
    [records, selectedMonth]
  );
  const highAttritionEmployees = useMemo(
    () => getHighAttritionRiskEmployees(filteredRecords),
    [filteredRecords]
  );
  const attritionTrend = useMemo(
    () => (selectedMonth === "All" ? null : getHighAttritionRiskTrend(records, selectedMonth)),
    [records, selectedMonth]
  );
  const deptData = useMemo(() => departmentBreakdown(filteredRecords), [filteredRecords]);
  const narrative = useMemo(() => buildNarrativeSummary(records, selectedMonth), [records, selectedMonth]);

  const cards: {
    key: CategoryKey;
    title: string;
    icon: LucideIcon;
    accent: Accent;
    count: number;
    subtext: string;
  }[] = [
    {
      key: "overtime",
      title: "Overtime Spikes",
      icon: Clock,
      accent: "amber",
      count: overtimeEmployees.length,
      subtext: `${overtimeByDept.length} dept${overtimeByDept.length === 1 ? "" : "s"} affected`,
    },
    {
      key: "lowComp",
      title: "Low Compensation",
      icon: TrendingDown,
      accent: "sky",
      count: lowCompEmployees.length,
      subtext: "Below grade median",
    },
    {
      key: "retention",
      title: "Retention Risk",
      icon: AlertTriangle,
      accent: "amber",
      count: retentionRiskEmployees.length,
      subtext: "High performers at risk",
    },
    {
      key: "promotion",
      title: "Promotion Candidates",
      icon: Award,
      accent: "emerald",
      count: promotionCandidates.length,
      subtext: "Qualified for promotion",
    },
    {
      key: "attrition",
      title: "High Attrition Risk",
      icon: ShieldAlert,
      accent: "rose",
      count: highAttritionEmployees.length,
      subtext: "Score 76+ / 100",
    },
  ];

  /**
   * Opens a category's detail page, resetting its filters to their defaults
   * first so a previous drill-down's filter selection doesn't leak into the
   * next one.
   *
   * @param key - CategoryKey - which category to open.
   */
  const openCategory = (key: CategoryKey) => {
    setOvertimeDeptFilter("All");
    setGradeFilter("All");
    setActive(key);
  };

  if (active === "overtime") {
    return (
      <DetailPage
        title="Overtime Spikes"
        description="Employees logging 1.5x+ their department's average overtime hours (20+ hr floor)."
        onBack={() => setActive(null)}
      >
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900">
                <th className="py-2 pl-4 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium text-right">Employees Affected</th>
              </tr>
            </thead>
            <tbody>
              <tr
                onClick={() => setOvertimeDeptFilter("All")}
                className={`cursor-pointer border-b border-slate-900 hover:bg-slate-800/60 ${
                  overtimeDeptFilter === "All" ? "bg-indigo-500/10" : ""
                }`}
              >
                <td className="py-2 pl-4 pr-4 font-medium text-slate-200">All Departments</td>
                <td className="py-2 pr-4 text-right text-slate-200 tabular-nums">{overtimeEmployees.length}</td>
              </tr>
              {overtimeByDept.map((d) => (
                <tr
                  key={d.department}
                  onClick={() => setOvertimeDeptFilter(d.department)}
                  className={`cursor-pointer border-b border-slate-900 hover:bg-slate-800/60 ${
                    overtimeDeptFilter === d.department ? "bg-indigo-500/10" : ""
                  }`}
                >
                  <td className="py-2 pl-4 pr-4 text-slate-200">{d.department}</td>
                  <td className="py-2 pr-4 text-right text-slate-200 tabular-nums">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {overtimeTrend && (
          <TrendBanner pctChange={overtimeTrend.pctChange} favorable={overtimeTrend.pctChange < 0}>
            {overtimeTrend.scope === "All" ? "Company-wide" : `${overtimeTrend.scope} department's`} overtime
            has {overtimeTrend.pctChange >= 0 ? "increased" : "decreased"} by{" "}
            <span className="font-semibold">{Math.abs(overtimeTrend.pctChange).toFixed(0)}%</span> compared to{" "}
            {overtimeTrend.prevMonth}.
          </TrendBanner>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <DataTable
            rows={overtimeFiltered}
            emptyLabel="No employees match this filter."
            columns={[
              nameCol,
              deptCol,
              gradeCol,
              { header: "OT Hours", align: "right", render: (r) => `${r.OvertimeHours} hrs` },
              { header: "OT Pay", align: "right", render: (r) => formatCurrency(r.OvertimePay) },
            ]}
          />
        </div>
      </DetailPage>
    );
  }

  if (active === "lowComp") {
    return (
      <DetailPage
        title="Low Compensation Relative to Grade"
        description="Employees earning 15%+ below their grade's median salary for this period."
        onBack={() => setActive(null)}
      >
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All Grades" active={gradeFilter === "All"} onClick={() => setGradeFilter("All")} />
          {GRADES.map((g) => (
            <FilterPill key={g} label={g} active={gradeFilter === g} onClick={() => setGradeFilter(g)} />
          ))}
        </div>

        {lowCompTrend && (
          <TrendBanner pctChange={lowCompTrend.pctChange} favorable={lowCompTrend.pctChange < 0}>
            {gradeFilter === "All" ? "Low-compensation headcount" : `${gradeFilter} low-compensation headcount`}{" "}
            has {lowCompTrend.pctChange >= 0 ? "increased" : "decreased"} by{" "}
            <span className="font-semibold">{Math.abs(lowCompTrend.pctChange).toFixed(0)}%</span> compared to{" "}
            {lowCompTrend.prevMonth}.
          </TrendBanner>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <DataTable<LowCompEmployee>
            rows={lowCompFiltered}
            emptyLabel="No employees match this filter."
            columns={[
              nameCol,
              deptCol,
              gradeCol,
              { header: "Salary", align: "right", render: (r) => formatCurrency(r.MonthlySalary) },
              { header: "Grade Median", align: "right", render: (r) => formatCurrency(r.gradeMedianSalary) },
              { header: "% Below", align: "right", render: (r) => formatPercent(r.pctBelowMedian, 0) },
            ]}
          />
        </div>
      </DetailPage>
    );
  }

  if (active === "retention") {
    return (
      <DetailPage
        title="Retention Risk"
        description="High performers (rating 4.0+) with an elevated attrition risk score (60+)."
        onBack={() => setActive(null)}
      >
        {retentionTrend && (
          <TrendBanner pctChange={retentionTrend.pctChange} favorable={retentionTrend.pctChange < 0}>
            Retention risk headcount has {retentionTrend.pctChange >= 0 ? "increased" : "decreased"} by{" "}
            <span className="font-semibold">{Math.abs(retentionTrend.pctChange).toFixed(0)}%</span> compared to{" "}
            {retentionTrend.prevMonth}.
          </TrendBanner>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <DataTable
            rows={retentionRiskEmployees}
            emptyLabel="No high performers currently flagged as retention risks."
            columns={[
              nameCol,
              deptCol,
              gradeCol,
              { header: "Rating", align: "right", render: (r) => `${r.PerformanceRating.toFixed(1)} / 5.0` },
              { header: "Risk Score", align: "right", render: (r) => `${r.AttritionRiskScore} / 100` },
            ]}
          />
        </div>
      </DetailPage>
    );
  }

  if (active === "promotion") {
    return (
      <DetailPage
        title="Potential Promotion Candidates"
        description="Employees with a performance rating above 4.2, qualifying as promotion eligible."
        onBack={() => setActive(null)}
      >
        {promotionTrend && (
          <TrendBanner pctChange={promotionTrend.pctChange} favorable={promotionTrend.pctChange >= 0}>
            Promotion-eligible headcount has {promotionTrend.pctChange >= 0 ? "increased" : "decreased"} by{" "}
            <span className="font-semibold">{Math.abs(promotionTrend.pctChange).toFixed(0)}%</span> compared to{" "}
            {promotionTrend.prevMonth}.
          </TrendBanner>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <DataTable
            rows={promotionCandidates}
            emptyLabel="No promotion-eligible employees for this period."
            columns={[
              nameCol,
              deptCol,
              gradeCol,
              { header: "Rating", align: "right", render: (r) => `${r.PerformanceRating.toFixed(1)} / 5.0` },
            ]}
          />
        </div>
      </DetailPage>
    );
  }

  if (active === "attrition") {
    return (
      <DetailPage
        title="High Attrition Risk"
        description="Employees with an attrition risk score of 76 or higher."
        onBack={() => setActive(null)}
      >
        {attritionTrend && (
          <TrendBanner pctChange={attritionTrend.pctChange} favorable={attritionTrend.pctChange < 0}>
            High attrition risk headcount has {attritionTrend.pctChange >= 0 ? "increased" : "decreased"} by{" "}
            <span className="font-semibold">{Math.abs(attritionTrend.pctChange).toFixed(0)}%</span> compared to{" "}
            {attritionTrend.prevMonth}.
          </TrendBanner>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <DataTable
            rows={highAttritionEmployees}
            emptyLabel="No employees currently at high attrition risk."
            columns={[
              nameCol,
              deptCol,
              gradeCol,
              { header: "Risk Score", align: "right", render: (r) => `${r.AttritionRiskScore} / 100` },
            ]}
          />
        </div>
      </DetailPage>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Automated Insights &mdash; {selectedMonth === "All" ? "All Months" : selectedMonth}
          </h3>
          <span className="text-xs text-slate-500">
            {formatNumber(filteredRecords.length)} records scanned
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => openCategory(c.key)}
                className="text-left rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:bg-slate-900 hover:border-slate-700 transition-colors"
              >
                <div className={`inline-flex rounded-lg p-2 mb-3 ${ACCENT_CLASSES[c.accent]}`}>
                  <Icon size={16} />
                </div>
                <p className="text-xs text-slate-400">{c.title}</p>
                <p className="mt-1 text-xl font-semibold text-slate-50 tabular-nums">{c.count}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{c.subtext}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Department Snapshot</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium text-right">Headcount</th>
                <th className="py-2 pr-4 font-medium text-right">Total Payroll</th>
                <th className="py-2 pr-4 font-medium text-right">Avg Salary</th>
                <th className="py-2 pr-4 font-medium text-right">OT Hours</th>
                <th className="py-2 pr-4 font-medium text-right">OT Pay</th>
              </tr>
            </thead>
            <tbody>
              {deptData.map((d) => (
                <tr key={d.department} className="border-b border-slate-900">
                  <td className="py-2 pr-4 text-slate-200">{d.department}</td>
                  <td className="py-2 pr-4 text-right text-slate-400 tabular-nums">{formatNumber(d.headcount)}</td>
                  <td className="py-2 pr-4 text-right text-slate-200 tabular-nums">{formatCurrency(d.totalPayroll)}</td>
                  <td className="py-2 pr-4 text-right text-slate-400 tabular-nums">{formatCurrency(d.avgSalary)}</td>
                  <td className="py-2 pr-4 text-right text-slate-400 tabular-nums">{formatNumber(d.totalOvertimeHours)}</td>
                  <td className="py-2 pr-4 text-right text-slate-400 tabular-nums">{formatCurrency(d.totalOvertimePay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {narrative && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
              <Sparkles size={14} />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">AI HR Summary</h3>
            <span className="text-xs text-slate-500">
              {narrative.prevMonth} &rarr; {narrative.month}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{narrative.sentences.join(" ")}</p>
        </div>
      )}
    </div>
  );
}
