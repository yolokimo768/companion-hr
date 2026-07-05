import { Fragment, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import { StatusBadge } from "../components/StatusBadge";
import { formatCurrency } from "../utils/format";
import { DEPARTMENTS, GRADES, MONTH_ORDER, type HRRecord } from "../types";

/** Number of table rows shown per page. */
const PAGE_SIZE = 50;
/** Number of `<th>`/`<td>` columns in the results table, used for the colSpan of the expanded-detail and empty-state rows. */
const COLUMN_COUNT = 7;

/**
 * Builds a stable, unique React key (and row-selection identifier) for a
 * single employee-month record.
 *
 * @param r - HRRecord - the record to key.
 * @returns string - `${EmployeeID}-${Month}`, unique per employee per month.
 */
function rowKey(r: HRRecord): string {
  return `${r.EmployeeID}-${r.Month}`;
}

/**
 * Searchable, filterable, paginated table of every employee record. Clicking
 * a row expands an inline detail panel directly beneath it (rather than
 * navigating away), showing the employee's full stats and — when more than
 * one month of history is available for them — a month-by-month
 * compensation trend.
 */
export function EmployeeSearch() {
  const { filteredRecords, records } = useHRData();
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // `filteredRecords` (already scoped to the header's month selector) further
  // narrowed by the free-text search box and the department/grade dropdowns.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filteredRecords.filter((r) => {
      if (deptFilter !== "All" && r.Department !== deptFilter) return false;
      if (gradeFilter !== "All" && r.Grade !== gradeFilter) return false;
      if (q && !r.Name.toLowerCase().includes(q) && !r.EmployeeID.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [filteredRecords, query, deptFilter, gradeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  // The full record for whichever row is currently expanded, if any.
  const selected = useMemo(
    () => pageRows.find((r) => rowKey(r) === selectedKey) ?? null,
    [pageRows, selectedKey]
  );

  // Every month's record for the selected employee (across the *entire*
  // dataset, not just the current month filter), sorted chronologically, so
  // the expanded panel can show a full trend regardless of the header's
  // month selector.
  const employeeHistory = useMemo(() => {
    if (!selected) return [];
    return records
      .filter((r) => r.EmployeeID === selected.EmployeeID)
      .sort((a, b) => MONTH_ORDER.indexOf(a.Month) - MONTH_ORDER.indexOf(b.Month));
  }, [records, selected]);

  /**
   * Runs a filter-changing state update and then resets pagination/selection,
   * so changing a filter never leaves the user stranded on a page or with a
   * stale row expanded that no longer matches the new filter.
   *
   * @param fn - () => void - the state setter to run (e.g. `() => setQuery(value)`).
   */
  const resetPage = (fn: () => void) => {
    fn();
    setPage(0);
    setSelectedKey(null);
  };

  /**
   * Toggles a table row's expanded detail panel: expands it if collapsed,
   * collapses it if it's the currently-expanded row.
   *
   * @param r - HRRecord - the row that was clicked.
   */
  const toggleRow = (r: HRRecord) => {
    const key = rowKey(r);
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => resetPage(() => setQuery(e.target.value))}
            placeholder="Search by name or employee ID&hellip;"
            className="w-full rounded-md border border-slate-700 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => resetPage(() => setDeptFilter(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-200"
        >
          <option value="All">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={gradeFilter}
          onChange={(e) => resetPage(() => setGradeFilter(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-200"
        >
          <option value="All">All Grades</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900">
                <th className="py-2 pl-4 pr-3 font-medium">Employee</th>
                <th className="hidden sm:table-cell py-2 pr-3 font-medium">Dept</th>
                <th className="hidden md:table-cell py-2 pr-3 font-medium">Grade</th>
                <th className="py-2 pr-3 font-medium text-right">Salary</th>
                <th className="hidden md:table-cell py-2 pr-3 font-medium text-right">Rating</th>
                <th className="hidden sm:table-cell py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const key = rowKey(r);
                const isOpen = key === selectedKey;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => toggleRow(r)}
                      className={`cursor-pointer border-b border-slate-900 hover:bg-slate-800/60 ${
                        isOpen ? "bg-indigo-500/10" : ""
                      }`}
                    >
                      <td className="py-2 pl-4 pr-3">
                        <div className="text-slate-200">{r.Name}</div>
                        <div className="text-xs text-slate-500">
                          {r.EmployeeID}
                          <span className="sm:hidden text-slate-600"> &middot; {r.Department}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell py-2 pr-3 text-slate-400">{r.Department}</td>
                      <td className="hidden md:table-cell py-2 pr-3 text-slate-400">{r.Grade}</td>
                      <td className="py-2 pr-3 text-right text-slate-200 tabular-nums">
                        {formatCurrency(r.MonthlySalary)}
                      </td>
                      <td className="hidden md:table-cell py-2 pr-3 text-right text-slate-400 tabular-nums">
                        {r.PerformanceRating.toFixed(1)}
                      </td>
                      <td className="hidden sm:table-cell py-2 pr-3">
                        {r.PromotionEligible && <StatusBadge label="Eligible" tone="success" />}
                        {r.AttritionRiskScore >= 76 && (
                          <span className="ml-1 inline-block">
                            <StatusBadge label="High Risk" tone="danger" />
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">
                        <ChevronDown
                          size={15}
                          className={`transition-transform ${isOpen ? "rotate-180 text-indigo-400" : ""}`}
                        />
                      </td>
                    </tr>
                    {isOpen && selected && (
                      <tr key={`${key}-detail`} className="bg-slate-950/60 border-b border-slate-800">
                        <td colSpan={COLUMN_COUNT} className="p-0 w-full max-w-0">
                          <EmployeeDetailPanel
                            employee={selected}
                            history={employeeHistory}
                            onClose={() => setSelectedKey(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-8 text-center text-sm text-slate-500">
                    No employees match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-xs text-slate-500">
          <span>
            Showing {pageRows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1}
            &ndash;{currentPage * PAGE_SIZE + pageRows.length} of {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                setSelectedKey(null);
              }}
              disabled={currentPage === 0}
              className="rounded-md border border-slate-700 p-1.5 hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span>Page {currentPage + 1} of {pageCount}</span>
            <button
              onClick={() => {
                setPage((p) => Math.min(pageCount - 1, p + 1));
                setSelectedKey(null);
              }}
              disabled={currentPage >= pageCount - 1}
              className="rounded-md border border-slate-700 p-1.5 hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Props for `EmployeeDetailPanel`.
 *
 * - employee: HRRecord - the specific employee-month record the panel is showing (determines which month is highlighted as "current" in the trend grid).
 * - history: HRRecord[] - every month's record for this employee, sorted chronologically, used to render the Monthly Trend cards.
 * - onClose: () => void - callback fired when the panel's close (X) button is clicked.
 */
interface EmployeeDetailPanelProps {
  employee: HRRecord;
  history: HRRecord[];
  onClose: () => void;
}

/**
 * The expanded detail view shown inline beneath a clicked employee row: key
 * status badges, a full stat breakdown for the selected month, and (when
 * more than one month of history exists) a small grid of stat cards showing
 * total compensation per month with a month-over-month percentage delta.
 *
 * @param props - EmployeeDetailPanelProps - see `EmployeeDetailPanelProps` for each field's meaning.
 */
function EmployeeDetailPanel({ employee, history, onClose }: EmployeeDetailPanelProps) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-50">{employee.Name}</h3>
          <p className="text-xs text-slate-500">
            {employee.EmployeeID} &middot; {employee.Department} &middot; {employee.Grade}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {employee.PromotionEligible && <StatusBadge label="Promotion Eligible" tone="success" />}
        {employee.AttritionRiskScore >= 76 && <StatusBadge label="High Attrition Risk" tone="danger" />}
        {employee.AttritionRiskScore <= 25 && <StatusBadge label="Low Attrition Risk" tone="info" />}
        {employee.PerformanceRating >= 4.5 && <StatusBadge label="Top Performer" tone="success" />}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Monthly Salary</dt>
            <dd className="font-medium text-slate-100 tabular-nums">{formatCurrency(employee.MonthlySalary)}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Overtime Hours</dt>
            <dd className="font-medium text-slate-100 tabular-nums">{employee.OvertimeHours} hrs</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Overtime Pay</dt>
            <dd className="font-medium text-slate-100 tabular-nums">{formatCurrency(employee.OvertimePay)}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Total Compensation</dt>
            <dd className="font-semibold text-slate-50 tabular-nums">
              {formatCurrency(employee.MonthlySalary + employee.OvertimePay)}
            </dd>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <dt className="text-slate-500">Performance Rating</dt>
            <dd className="font-medium text-slate-100 tabular-nums">{employee.PerformanceRating.toFixed(1)} / 5.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Attrition Risk Score</dt>
            <dd className="font-medium text-slate-100 tabular-nums">{employee.AttritionRiskScore} / 100</dd>
          </div>
        </dl>

        {history.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Monthly Trend</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {history.map((h, i) => {
                const comp = h.MonthlySalary + h.OvertimePay;
                const prevComp = i > 0 ? history[i - 1].MonthlySalary + history[i - 1].OvertimePay : null;
                const deltaPct = prevComp ? ((comp - prevComp) / prevComp) * 100 : null;
                const isCurrent = h.Month === employee.Month;
                return (
                  <div
                    key={h.Month}
                    className={`rounded-lg border px-3 py-2 ${
                      isCurrent
                        ? "border-indigo-500/50 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-900/40"
                    }`}
                  >
                    <p className="text-[10px] font-medium text-slate-500">{h.Month}</p>
                    <p className="text-sm font-semibold text-slate-100 tabular-nums">
                      {formatCurrency(comp, { compact: true })}
                    </p>
                    {deltaPct !== null && (
                      <p
                        className={`text-[10px] tabular-nums ${
                          deltaPct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
