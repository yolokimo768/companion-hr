import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DollarSign, Clock, Users, ShieldAlert } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import { MetricCard } from "../components/MetricCard";
import { StatusBadge } from "../components/StatusBadge";
import {
  totalPayroll,
  totalOvertimeHours,
  totalOvertimePay,
  activeHeadcount,
  avgAttritionRisk,
  departmentBreakdown,
  gradeCompensationDistribution,
  attritionRiskDistribution,
  promotionEligibilityDistribution,
  departmentPromotionEligibility,
  topCompensated,
} from "../utils/aggregate";
import { formatCurrency, formatNumber, formatPercent } from "../utils/format";

/** Donut-slice colors for the Attrition Risk Distribution chart, in the same order as its 4 buckets (Low, Moderate, Elevated, High). */
const RISK_COLORS = ["#34d399", "#fbbf24", "#fb923c", "#f43f5e"];
/** Donut-slice colors for the Promotion Eligibility Distribution chart: [Eligible, Not Eligible]. */
const ELIGIBILITY_COLORS = ["#34d399", "#334155"];
/** Shared background color for chart tooltips, matching the app's dark theme. */
const CARD_BG = "#0f172a";
/** Shared gridline color for bar charts. */
const GRID_STROKE = "#1e293b";
/** Shared axis label/tick color for charts. */
const AXIS_COLOR = "#64748b";

/**
 * A titled card wrapper with a fixed-height chart area, used to keep every
 * chart on this page visually consistent.
 *
 * @param title - string - the heading shown above the chart.
 * @param children - React.ReactNode - the chart element(s) to render inside the fixed-height area.
 */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

/**
 * The company-wide compensation overview page: top-line metric cards,
 * department/grade/risk/eligibility charts, and a top-10 highest-compensated
 * employees table. All figures are derived client-side from
 * `useHRData().filteredRecords` (the dataset scoped to the header's month
 * selector) via the aggregation helpers in `utils/aggregate.ts`.
 */
export function PayrollDashboard() {
  const { filteredRecords, selectedMonth } = useHRData();

  const payroll = useMemo(() => totalPayroll(filteredRecords), [filteredRecords]);
  const otHours = useMemo(() => totalOvertimeHours(filteredRecords), [filteredRecords]);
  const otPay = useMemo(() => totalOvertimePay(filteredRecords), [filteredRecords]);
  const headcount = useMemo(() => activeHeadcount(filteredRecords), [filteredRecords]);
  const avgRisk = useMemo(() => avgAttritionRisk(filteredRecords), [filteredRecords]);
  const deptData = useMemo(() => departmentBreakdown(filteredRecords), [filteredRecords]);
  const gradeData = useMemo(
    () => gradeCompensationDistribution(filteredRecords),
    [filteredRecords]
  );
  const riskData = useMemo(
    () => attritionRiskDistribution(filteredRecords),
    [filteredRecords]
  );
  const eligibilityData = useMemo(
    () => promotionEligibilityDistribution(filteredRecords),
    [filteredRecords]
  );
  const deptEligibility = useMemo(
    () => departmentPromotionEligibility(filteredRecords),
    [filteredRecords]
  );
  const top10 = useMemo(() => topCompensated(filteredRecords, 10), [filteredRecords]);

  const eligibleCount = eligibilityData[0]?.count ?? 0;
  const eligiblePct = filteredRecords.length > 0 ? (eligibleCount / filteredRecords.length) * 100 : 0;

  // Recharts-friendly shapes derived from the aggregate arrays above (each
  // chart library call expects an array of {name, <seriesKey>} objects).
  const deptChartData = deptData.map((d) => ({
    name: d.department,
    Payroll: Math.round(d.totalPayroll),
  }));
  const otChartData = deptData.map((d) => ({
    name: d.department,
    "OT Hours": d.totalOvertimeHours,
  }));
  const gradeChartData = gradeData.map((g) => ({
    name: g.grade,
    "Avg Salary": Math.round(g.avgSalary),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label={`Total Payroll (${selectedMonth === "All" ? "All Months" : selectedMonth})`}
          value={formatCurrency(payroll, { compact: true })}
          icon={DollarSign}
          accent="indigo"
          subtext={`${formatNumber(filteredRecords.length)} records`}
        />
        <MetricCard
          label="Total Overtime"
          value={`${formatNumber(otHours)} hrs`}
          icon={Clock}
          accent="amber"
          subtext={`${formatCurrency(otPay, { compact: true })} in OT pay`}
        />
        <MetricCard
          label="Active Headcount"
          value={formatNumber(headcount)}
          icon={Users}
          accent="emerald"
          subtext="Unique employees"
        />
        <MetricCard
          label="Avg Attrition Risk"
          value={avgRisk.toFixed(1)}
          icon={ShieldAlert}
          accent="rose"
          subtext="Score out of 100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Department Payroll">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptChartData} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_COLOR }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
              <Tooltip
                contentStyle={{ background: CARD_BG, border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Bar dataKey="Payroll" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Department Overtime">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otChartData} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_COLOR }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} />
              <Tooltip
                contentStyle={{ background: CARD_BG, border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="OT Hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Compensation Distribution by Grade">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gradeChartData} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_COLOR }} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} tickFormatter={(v) => formatCurrency(v, { compact: true })} />
              <Tooltip
                contentStyle={{ background: CARD_BG, border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatCurrency(Number(v))}
              />
              <Bar dataKey="Avg Salary" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Attrition Risk Distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                dataKey="count"
                nameKey="label"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
              >
                {riskData.map((_, i) => (
                  <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={24}
                formatter={(value) => <span className="text-slate-400 text-xs">{value}</span>}
              />
              <Tooltip
                contentStyle={{ background: CARD_BG, border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Promotion Eligibility Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eligibilityData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {eligibilityData.map((_, i) => (
                      <Cell key={i} fill={ELIGIBILITY_COLORS[i % ELIGIBILITY_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    formatter={(value) => <span className="text-slate-400 text-xs">{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: CARD_BG, border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <p className="text-xs text-slate-400">Company-wide eligible</p>
                <p className="text-lg font-semibold text-emerald-400 tabular-nums">
                  {formatNumber(eligibleCount)} <span className="text-xs text-slate-500 font-normal">({formatPercent(eligiblePct)})</span>
                </p>
              </div>
              <div className="space-y-2">
                {deptEligibility.map((d) => {
                  const pct = d.total > 0 ? (d.eligible / d.total) * 100 : 0;
                  return (
                    <div key={d.department} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{d.department}</span>
                      <span className="text-slate-200 tabular-nums">
                        {d.eligible} / {d.total}
                        <span className="ml-1.5 text-xs text-slate-500">({formatPercent(pct, 0)})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">
          Top 10 Highest-Compensated Employees
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Grade</th>
                <th className="py-2 pr-4 font-medium text-right">Salary</th>
                <th className="py-2 pr-4 font-medium text-right">OT Pay</th>
                <th className="py-2 pr-4 font-medium text-right">Total Comp</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((e) => (
                <tr key={`${e.EmployeeID}-${e.Month}`} className="border-b border-slate-900 hover:bg-slate-900/50">
                  <td className="py-2 pr-4 text-slate-200">{e.Name}</td>
                  <td className="py-2 pr-4 text-slate-400">{e.Department}</td>
                  <td className="py-2 pr-4 text-slate-400">{e.Grade}</td>
                  <td className="py-2 pr-4 text-right text-slate-200 tabular-nums">
                    {formatCurrency(e.MonthlySalary)}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-400 tabular-nums">
                    {formatCurrency(e.OvertimePay)}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold text-slate-50 tabular-nums">
                    {formatCurrency(e.totalCompensation)}
                  </td>
                  <td className="py-2 pr-4">
                    {e.PromotionEligible && (
                      <StatusBadge label="Promotion Eligible" tone="success" />
                    )}
                    {e.AttritionRiskScore >= 76 && (
                      <span className="ml-1 inline-block">
                        <StatusBadge label="High Risk" tone="danger" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
