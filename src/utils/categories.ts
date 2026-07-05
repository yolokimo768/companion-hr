import type { Department, Grade, HRRecord, MonthName } from "../types";
import { DEPARTMENTS, GRADES, MONTH_ORDER } from "../types";
import { mean, median } from "./aggregate";

/** AttritionRiskScore (1-100) at or above this value flags an employee as "high attrition risk". */
const HIGH_ATTRITION_THRESHOLD = 76;
/** AttritionRiskScore (1-100) at or above this value counts toward "retention risk" for high performers. */
const RETENTION_RISK_THRESHOLD = 60;
/** PerformanceRating (1.0-5.0) at or above this value counts as a "high performer". */
const HIGH_PERFORMER_THRESHOLD = 4.0;
/** Salary below this fraction of the employee's grade median flags them as underpaid ("low compensation"). */
const LOW_COMP_RATIO = 0.85; // flag salaries 15%+ below grade median
/** An employee's overtime is a "spike" once it reaches this multiple of their department's average. */
const OT_SPIKE_MULTIPLIER = 1.5;
/** Minimum overtime hours required before the multiplier check even applies, so low-hour departments don't produce noisy false positives. */
const OT_SPIKE_MIN_HOURS = 20;

/**
 * Overtime-spike count for a single department.
 *
 * - department: Department - which department this count describes.
 * - count: number - number of employee records in the department flagged as overtime spikes by `getOvertimeSpikeEmployees`.
 */
export interface DepartmentOvertimeSpike {
  department: Department;
  count: number;
}

/**
 * Flags every record whose overtime hours are at least 1.5x that record's
 * department average (and at least 20 hours), identifying individual
 * "overtime spike" employees.
 *
 * @param records - HRRecord[] - the rows to scan (each department's average is computed from this same set).
 * @returns HRRecord[] - the subset of `records` whose OvertimeHours exceeds their department's average by OT_SPIKE_MULTIPLIER and clears the OT_SPIKE_MIN_HOURS floor.
 */
export function getOvertimeSpikeEmployees(records: HRRecord[]): HRRecord[] {
  const deptAvgHours = new Map<Department, number>();
  for (const dept of DEPARTMENTS) {
    const hours = records.filter((r) => r.Department === dept).map((r) => r.OvertimeHours);
    deptAvgHours.set(dept, mean(hours));
  }
  return records.filter((r) => {
    const avg = deptAvgHours.get(r.Department) ?? 0;
    return avg > 0 && r.OvertimeHours >= avg * OT_SPIKE_MULTIPLIER && r.OvertimeHours >= OT_SPIKE_MIN_HOURS;
  });
}

/**
 * Counts overtime-spike employees per department and returns only the
 * departments with at least one, ranked highest-count first. Powers the
 * clickable department table on the Executive Summary's Overtime Spikes page.
 *
 * @param records - HRRecord[] - the rows to scan.
 * @returns DepartmentOvertimeSpike[] - one entry per affected department, sorted descending by count. Departments with zero spikes are omitted.
 */
export function getOvertimeSpikesByDepartment(records: HRRecord[]): DepartmentOvertimeSpike[] {
  const flagged = getOvertimeSpikeEmployees(records);
  const counts = new Map<Department, number>();
  for (const r of flagged) {
    counts.set(r.Department, (counts.get(r.Department) ?? 0) + 1);
  }
  return DEPARTMENTS.map((department) => ({ department, count: counts.get(department) ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * An HRRecord annotated with the grade-relative context used to explain why
 * it was flagged as underpaid.
 *
 * - gradeMedianSalary: number - the median MonthlySalary across all records sharing this employee's grade.
 * - pctBelowMedian: number - how far below that grade median this employee's salary sits, as a percentage (e.g. 20 means 20% below median).
 */
export interface LowCompEmployee extends HRRecord {
  gradeMedianSalary: number;
  pctBelowMedian: number;
}

/**
 * Flags every record paid at least 15% below its grade's median salary
 * (LOW_COMP_RATIO), identifying employees who may be underpaid relative to
 * peers at the same grade.
 *
 * @param records - HRRecord[] - the rows to scan (each grade's median is computed from this same set).
 * @returns LowCompEmployee[] - the subset of `records` that fall below their grade's median * LOW_COMP_RATIO, sorted descending by pctBelowMedian (most underpaid first).
 */
export function getLowCompensationEmployees(records: HRRecord[]): LowCompEmployee[] {
  const gradeMedians = new Map<Grade, number>();
  for (const grade of GRADES) {
    const salaries = records.filter((r) => r.Grade === grade).map((r) => r.MonthlySalary);
    gradeMedians.set(grade, median(salaries));
  }
  return records
    .filter((r) => {
      const med = gradeMedians.get(r.Grade) ?? 0;
      return med > 0 && r.MonthlySalary < med * LOW_COMP_RATIO;
    })
    .map((r) => {
      const med = gradeMedians.get(r.Grade) ?? 0;
      return {
        ...r,
        gradeMedianSalary: med,
        pctBelowMedian: med > 0 ? ((med - r.MonthlySalary) / med) * 100 : 0,
      };
    })
    .sort((a, b) => b.pctBelowMedian - a.pctBelowMedian);
}

/**
 * Flags high performers (rating >= 4.0) who also carry an elevated attrition
 * risk score (>= 60) — i.e. valuable people who might leave, and therefore
 * need a retention plan.
 *
 * @param records - HRRecord[] - the rows to scan.
 * @returns HRRecord[] - the subset of `records` meeting both thresholds, sorted descending by AttritionRiskScore (most urgent first).
 */
export function getRetentionRiskEmployees(records: HRRecord[]): HRRecord[] {
  return records
    .filter((r) => r.PerformanceRating >= HIGH_PERFORMER_THRESHOLD && r.AttritionRiskScore >= RETENTION_RISK_THRESHOLD)
    .sort((a, b) => b.AttritionRiskScore - a.AttritionRiskScore);
}

/**
 * Filters to every record flagged as promotion-eligible in the source data.
 *
 * @param records - HRRecord[] - the rows to scan.
 * @returns HRRecord[] - the subset of `records` with PromotionEligible === true, sorted descending by PerformanceRating (strongest candidates first).
 */
export function getPromotionCandidates(records: HRRecord[]): HRRecord[] {
  return records
    .filter((r) => r.PromotionEligible)
    .sort((a, b) => b.PerformanceRating - a.PerformanceRating);
}

/**
 * Flags every record with an attrition risk score of 76 or higher
 * (HIGH_ATTRITION_THRESHOLD), regardless of performance.
 *
 * @param records - HRRecord[] - the rows to scan.
 * @returns HRRecord[] - the subset of `records` at or above the high-attrition threshold, sorted descending by AttritionRiskScore.
 */
export function getHighAttritionRiskEmployees(records: HRRecord[]): HRRecord[] {
  return records
    .filter((r) => r.AttritionRiskScore >= HIGH_ATTRITION_THRESHOLD)
    .sort((a, b) => b.AttritionRiskScore - a.AttritionRiskScore);
}

/**
 * Month-over-month overtime comparison for a given scope (a single
 * department, or the whole company).
 *
 * - scope: Department | "All" - which department this trend covers, or "All" for company-wide.
 * - month: MonthName - the "current" month being reported on.
 * - prevMonth: MonthName - the month immediately before `month` in MONTH_ORDER, used as the comparison baseline.
 * - currentTotal: number - total overtime hours in `scope` during `month`.
 * - prevTotal: number - total overtime hours in `scope` during `prevMonth`.
 * - pctChange: number - percentage change from prevTotal to currentTotal (positive = increase).
 */
export interface OvertimeTrend {
  scope: Department | "All";
  month: MonthName;
  prevMonth: MonthName;
  currentTotal: number;
  prevTotal: number;
  pctChange: number;
}

/**
 * Compares total overtime hours for `month` against the prior month, scoped
 * to either a single department or the whole company. Powers the trend
 * banner shown above the Overtime Spikes table on the Executive Summary page.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset (both `month` and `prevMonth` rows must be present in it, regardless of any UI month filter).
 * @param scope - Department | "All" - restrict the comparison to one department, or "All" for the whole company.
 * @param month - MonthName - the month to report the trend for.
 * @returns OvertimeTrend | null - the comparison, or null if there is no prior month in MONTH_ORDER to compare against, or if the prior month's total was 0 (would make the percentage change meaningless/divide-by-zero).
 */
export function getOvertimeTrend(
  allRecords: HRRecord[],
  scope: Department | "All",
  month: MonthName
): OvertimeTrend | null {
  const idx = MONTH_ORDER.indexOf(month);
  if (idx <= 0) return null; // no prior month to compare against

  const prevMonth = MONTH_ORDER[idx - 1];
  const inScope = (r: HRRecord) => scope === "All" || r.Department === scope;

  const currentTotal = allRecords
    .filter((r) => r.Month === month && inScope(r))
    .reduce((sum, r) => sum + r.OvertimeHours, 0);
  const prevTotal = allRecords
    .filter((r) => r.Month === prevMonth && inScope(r))
    .reduce((sum, r) => sum + r.OvertimeHours, 0);

  if (prevTotal === 0) return null;

  return {
    scope,
    month,
    prevMonth,
    currentTotal,
    prevTotal,
    pctChange: ((currentTotal - prevTotal) / prevTotal) * 100,
  };
}

/**
 * Month-over-month headcount comparison for one of the category lists
 * (retention risk, promotion candidates, etc.) — i.e. how many employees
 * were flagged in this category last month vs. this month.
 *
 * - month: MonthName - the "current" month being reported on.
 * - prevMonth: MonthName - the month immediately before `month` in MONTH_ORDER.
 * - currentCount: number - how many employees matched the category in `month`.
 * - prevCount: number - how many employees matched the category in `prevMonth`.
 * - pctChange: number - percentage change from prevCount to currentCount (positive = increase).
 */
export interface CategoryTrend {
  month: MonthName;
  prevMonth: MonthName;
  currentCount: number;
  prevCount: number;
  pctChange: number;
}

/**
 * Shared helper that computes a month-over-month headcount trend for any
 * category-selection function (e.g. `getRetentionRiskEmployees`). Not
 * exported directly — each category gets its own thin wrapper below so
 * callers don't need to know which selector function to pass in.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset (both `month` and its prior month must be present).
 * @param month - MonthName - the month to report the trend for.
 * @param selectEmployees - (records: HRRecord[]) => HRRecord[] - the category filter to apply to each month's rows (e.g. `getRetentionRiskEmployees`).
 * @returns CategoryTrend | null - the comparison, or null if there is no prior month, or the prior month's matching count was 0.
 */
function getCategoryTrend(
  allRecords: HRRecord[],
  month: MonthName,
  selectEmployees: (records: HRRecord[]) => HRRecord[]
): CategoryTrend | null {
  const idx = MONTH_ORDER.indexOf(month);
  if (idx <= 0) return null; // no prior month to compare against

  const prevMonth = MONTH_ORDER[idx - 1];
  const currentCount = selectEmployees(allRecords.filter((r) => r.Month === month)).length;
  const prevCount = selectEmployees(allRecords.filter((r) => r.Month === prevMonth)).length;

  if (prevCount === 0) return null;

  return {
    month,
    prevMonth,
    currentCount,
    prevCount,
    pctChange: ((currentCount - prevCount) / prevCount) * 100,
  };
}

/**
 * Month-over-month trend for the Low Compensation category, optionally
 * scoped to a single grade.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset.
 * @param month - MonthName - the month to report the trend for.
 * @param gradeFilter - Grade | "All" - restrict the comparison to one grade, or "All" for every grade.
 * @returns CategoryTrend | null - see `getCategoryTrend`.
 */
export function getLowCompensationTrend(
  allRecords: HRRecord[],
  month: MonthName,
  gradeFilter: Grade | "All"
): CategoryTrend | null {
  return getCategoryTrend(allRecords, month, (records) => {
    const employees = getLowCompensationEmployees(records);
    return gradeFilter === "All" ? employees : employees.filter((e) => e.Grade === gradeFilter);
  });
}

/**
 * Month-over-month trend for the Retention Risk category.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset.
 * @param month - MonthName - the month to report the trend for.
 * @returns CategoryTrend | null - see `getCategoryTrend`.
 */
export function getRetentionRiskTrend(allRecords: HRRecord[], month: MonthName): CategoryTrend | null {
  return getCategoryTrend(allRecords, month, getRetentionRiskEmployees);
}

/**
 * Month-over-month trend for the Promotion Candidates category.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset.
 * @param month - MonthName - the month to report the trend for.
 * @returns CategoryTrend | null - see `getCategoryTrend`.
 */
export function getPromotionCandidateTrend(allRecords: HRRecord[], month: MonthName): CategoryTrend | null {
  return getCategoryTrend(allRecords, month, getPromotionCandidates);
}

/**
 * Month-over-month trend for the High Attrition Risk category.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset.
 * @param month - MonthName - the month to report the trend for.
 * @returns CategoryTrend | null - see `getCategoryTrend`.
 */
export function getHighAttritionRiskTrend(allRecords: HRRecord[], month: MonthName): CategoryTrend | null {
  return getCategoryTrend(allRecords, month, getHighAttritionRiskEmployees);
}
