import Papa from "papaparse";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HRRecord, MonthName } from "../types";
import { MONTH_ORDER } from "../types";

/** The month-selector value: either one specific month, or "All" to include every month's rows. */
export type MonthFilter = MonthName | "All";

/**
 * The shape of the shared HR data context that every view reads from.
 *
 * - records: HRRecord[] - every row currently loaded, unfiltered by month.
 * - filteredRecords: HRRecord[] - `records` narrowed to `selectedMonth` (or all of `records` if `selectedMonth` is "All").
 * - loading: boolean - true while a CSV file is being parsed.
 * - error: string | null - a human-readable message if the last parse attempt failed, otherwise null.
 * - fileName: string - the display name of the currently-loaded CSV file.
 * - availableMonths: MonthName[] - the distinct months found in `records`, in chronological order.
 * - selectedMonth: MonthFilter - the month currently selected in the header's month dropdown.
 * - setSelectedMonth: (m: MonthFilter) => void - updates `selectedMonth`.
 * - loadFile: (file: File) => void - parses a user-supplied CSV file and replaces `records` with its contents.
 * - reloadDefault: (void) => void - re-fetches and parses the bundled `/hr_dataset.csv`, discarding any user-uploaded file.
 */
interface HRDataContextValue {
  records: HRRecord[];
  filteredRecords: HRRecord[];
  loading: boolean;
  error: string | null;
  fileName: string;
  availableMonths: MonthName[];
  selectedMonth: MonthFilter;
  setSelectedMonth: (m: MonthFilter) => void;
  loadFile: (file: File) => void;
  reloadDefault: () => void;
}

const HRDataContext = createContext<HRDataContextValue | null>(null);

/** Column names every uploaded CSV must contain; anything missing causes the upload to be rejected with an error message instead of silently producing broken rows. */
const REQUIRED_COLUMNS = [
  "EmployeeID",
  "Name",
  "Department",
  "Grade",
  "MonthlySalary",
  "OvertimeHours",
  "OvertimePay",
  "PerformanceRating",
  "AttritionRiskScore",
  "PromotionEligible",
  "Month",
];

/**
 * Converts one raw CSV row (all string values, as PapaParse hands them back)
 * into a properly-typed `HRRecord`, coercing numeric/boolean fields and
 * discarding rows that are missing their key identifiers.
 *
 * @param row - Record<string, string> - one parsed CSV row, keyed by column header.
 * @returns HRRecord | null - the typed record, or null if the row has no EmployeeID or Month (and should be dropped rather than included as broken data).
 */
function coerceRow(row: Record<string, string>): HRRecord | null {
  if (!row.EmployeeID || !row.Month) return null;
  return {
    EmployeeID: row.EmployeeID,
    Name: row.Name,
    Department: row.Department as HRRecord["Department"],
    Grade: row.Grade as HRRecord["Grade"],
    MonthlySalary: Number(row.MonthlySalary) || 0,
    OvertimeHours: Number(row.OvertimeHours) || 0,
    OvertimePay: Number(row.OvertimePay) || 0,
    PerformanceRating: Number(row.PerformanceRating) || 0,
    AttritionRiskScore: Number(row.AttritionRiskScore) || 0,
    PromotionEligible:
      String(row.PromotionEligible).trim().toUpperCase() === "TRUE",
    Month: row.Month as MonthName,
  };
}

/**
 * React context provider that owns the app's entire dataset and month-filter
 * state. Wraps the whole app so every view can read/mutate the same records
 * via `useHRData()` without prop drilling. All CSV parsing happens
 * client-side via PapaParse — no data is ever sent to a server.
 *
 * @param children - ReactNode - the app tree that should have access to the HR data context.
 */
export function HRDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<HRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("hr_dataset.csv");
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>("All");

  /**
   * Validates a completed PapaParse result against `REQUIRED_COLUMNS`, converts
   * each row via `coerceRow`, and commits the outcome to state (either the
   * parsed records, or an error message if validation/parsing failed).
   *
   * @param results - Papa.ParseResult<Record<string, string>> - the completed parse result from PapaParse.
   * @param name - string - the display name to store as `fileName` if parsing succeeds.
   */
  const handleResults = useCallback(
    (results: Papa.ParseResult<Record<string, string>>, name: string) => {
      const fields = results.meta.fields ?? [];
      const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
      if (missing.length > 0) {
        setError(`CSV is missing required columns: ${missing.join(", ")}`);
        setLoading(false);
        return;
      }
      const parsed = results.data
        .map(coerceRow)
        .filter((r): r is HRRecord => r !== null);
      if (parsed.length === 0) {
        setError("No valid rows found in the uploaded CSV.");
        setLoading(false);
        return;
      }
      setRecords(parsed);
      setFileName(name);
      setLoading(false);
    },
    []
  );

  /**
   * Parses a local `File` object (from a user's file picker) with PapaParse
   * and hands the result to `handleResults`.
   *
   * @param file - File - the CSV file selected by the user.
   */
  const parseFile = useCallback(
    (file: File) => {
      setLoading(true);
      setError(null);
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => handleResults(results, file.name),
        error: (err: Error) => {
          setError(err.message || "Failed to parse CSV file.");
          setLoading(false);
        },
      });
    },
    [handleResults]
  );

  /**
   * Downloads and parses a CSV from a URL (used to load the bundled default
   * dataset) with PapaParse and hands the result to `handleResults`.
   *
   * @param url - string - the URL to fetch the CSV from.
   * @param name - string - the display name to store as `fileName` if parsing succeeds.
   */
  const parseUrl = useCallback(
    (url: string, name: string) => {
      setLoading(true);
      setError(null);
      Papa.parse<Record<string, string>>(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => handleResults(results, name),
        error: (err: Error) => {
          setError(err.message || "Failed to parse CSV file.");
          setLoading(false);
        },
      });
    },
    [handleResults]
  );

  /**
   * Public entry point for uploading a user-supplied CSV file (exposed via
   * context as `loadFile`).
   *
   * @param file - File - the CSV file selected by the user.
   */
  const loadFile = useCallback(
    (file: File) => {
      parseFile(file);
    },
    [parseFile]
  );

  /**
   * Public entry point for (re-)loading the bundled default dataset (exposed
   * via context as `reloadDefault`). Used both on initial app load and
   * whenever the user clicks "Reload default dataset".
   */
  const reloadDefault = useCallback(() => {
    parseUrl(`${import.meta.env.BASE_URL}hr_dataset.csv`, "hr_dataset.csv");
  }, [parseUrl]);

  // Load the bundled default dataset once, on first mount.
  useEffect(() => {
    reloadDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The distinct months present in `records`, in chronological order (a
  // subset of MONTH_ORDER — a partial/custom upload may not cover all four).
  const availableMonths = useMemo(() => {
    const set = new Set(records.map((r) => r.Month));
    return MONTH_ORDER.filter((m) => set.has(m));
  }, [records]);

  // Whenever a new dataset loads, keep the current month selection if it's
  // still valid for the new data, otherwise default to the most recent month.
  useEffect(() => {
    if (availableMonths.length === 0) return;
    setSelectedMonth((prev) =>
      prev !== "All" && availableMonths.includes(prev)
        ? prev
        : availableMonths[availableMonths.length - 1]
    );
  }, [availableMonths]);

  // `records` narrowed down to the currently-selected month (or every record,
  // if "All Months" is selected). This is the array almost every view/chart
  // actually reads from.
  const filteredRecords = useMemo(() => {
    if (selectedMonth === "All") return records;
    return records.filter((r) => r.Month === selectedMonth);
  }, [records, selectedMonth]);

  const value: HRDataContextValue = {
    records,
    filteredRecords,
    loading,
    error,
    fileName,
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    loadFile,
    reloadDefault,
  };

  return (
    <HRDataContext.Provider value={value}>{children}</HRDataContext.Provider>
  );
}

/**
 * Hook for reading/mutating the shared HR dataset and month filter from any
 * component. Must be called from within an `HRDataProvider` (which wraps the
 * whole app in `App.tsx`).
 *
 * @returns HRDataContextValue - the current dataset, filter state, and loading/error status; see `HRDataContextValue` for each field's meaning.
 */
export function useHRData(): HRDataContextValue {
  const ctx = useContext(HRDataContext);
  if (!ctx) {
    throw new Error("useHRData must be used within an HRDataProvider");
  }
  return ctx;
}
