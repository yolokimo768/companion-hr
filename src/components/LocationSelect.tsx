import { useHRData } from "../hooks/useHRData";

/**
 * The global office/location-filter dropdown shown in the header, alongside
 * `MonthSelect`. Reads and writes `selectedLocation` directly from the shared
 * `useHRData` context, so changing it immediately re-scopes `filteredRecords`
 * — and therefore every view in the app — to a single office.
 */
export function LocationSelect() {
  const { availableLocations, selectedLocation, setSelectedLocation } = useHRData();

  if (availableLocations.length === 0) return null;

  return (
    <select
      value={selectedLocation}
      onChange={(e) => setSelectedLocation(e.target.value)}
      className="max-w-[100px] sm:max-w-none rounded-md border border-slate-700 bg-slate-800/80 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="All">All Offices</option>
      {availableLocations.map((loc) => (
        <option key={loc} value={loc}>
          {loc}
        </option>
      ))}
    </select>
  );
}
