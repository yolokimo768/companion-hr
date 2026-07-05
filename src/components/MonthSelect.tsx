import { useHRData } from "../hooks/useHRData";

/**
 * The global month-filter dropdown shown in the header. Reads and writes
 * `selectedMonth` directly from the shared `useHRData` context, so changing
 * it here immediately re-scopes `filteredRecords` for every view in the app.
 */
export function MonthSelect() {
  const { availableMonths, selectedMonth, setSelectedMonth } = useHRData();

  return (
    <select
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(e.target.value as typeof selectedMonth)}
      className="max-w-[110px] sm:max-w-none rounded-md border border-slate-700 bg-slate-800/80 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="All">All Months</option>
      {availableMonths.map((m) => (
        <option key={m} value={m}>
          {m} snapshot
        </option>
      ))}
    </select>
  );
}
