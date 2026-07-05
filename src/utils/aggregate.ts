import type { HRRecord, Department, Grade } from "../types";
import { DEPARTMENTS, GRADES } from "../types";

/**
 * Sums the monthly base salary across a set of records.
 *
 * @param records - HRRecord[] - the rows to sum over (e.g. one month's snapshot, or a single department's rows).
 * @returns number - total base salary in dollars across all `records`. Note this does not include overtime pay.
 */
export function totalPayroll(records: HRRecord[]): number {
  return records.reduce((sum, r) => sum + r.MonthlySalary, 0);
}

/**
 * Sums the overtime pay across a set of records.
 *
 * @param records - HRRecord[] - the rows to sum over.
 * @returns number - total overtime pay in dollars across all `records`.
 */
export function totalOvertimePay(records: HRRecord[]): number {
  return records.reduce((sum, r) => sum + r.OvertimePay, 0);
}

/**
 * Sums the overtime hours across a set of records.
 *
 * @param records - HRRecord[] - the rows to sum over.
 * @returns number - total overtime hours logged across all `records`.
 */
export function totalOvertimeHours(records: HRRecord[]): number {
  return records.reduce((sum, r) => sum + r.OvertimeHours, 0);
}

/**
 * Computes the average attrition risk score across a set of records.
 *
 * @param records - HRRecord[] - the rows to average over.
 * @returns number - mean AttritionRiskScore (1-100 scale) across `records`, or 0 if `records` is empty (guards against a divide-by-zero).
 */
export function avgAttritionRisk(records: HRRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, r) => sum + r.AttritionRiskScore, 0) / records.length;
}

/**
 * Counts the number of distinct employees represented in a set of records.
 * This is distinct from `records.length` because the dataset stores one row
 * per employee per month, so the same person can appear multiple times when
 * `records` spans more than one month.
 *
 * @param records - HRRecord[] - the rows to count unique employees within.
 * @returns number - count of unique EmployeeID values in `records`.
 */
export function activeHeadcount(records: HRRecord[]): number {
  return new Set(records.map((r) => r.EmployeeID)).size;
}

/**
 * Aggregated compensation and overtime figures for a single department.
 *
 * - department: Department - which department this aggregate describes.
 * - totalPayroll: number - summed base salary across the department's records.
 * - totalOvertimeHours: number - summed overtime hours across the department's records.
 * - totalOvertimePay: number - summed overtime pay across the department's records.
 * - headcount: number - count of unique employees in the department.
 * - avgSalary: number - totalPayroll divided by headcount (0 if headcount is 0).
 */
export interface DeptAggregate {
  department: Department;
  totalPayroll: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  headcount: number;
  avgSalary: number;
}

/**
 * Builds a per-department compensation/overtime summary, one entry for every
 * department in `DEPARTMENTS` (even if a department has zero matching rows).
 *
 * @param records - HRRecord[] - the rows to break down by department (typically the current month's filtered records).
 * @returns DeptAggregate[] - one aggregate object per department, in the same order as `DEPARTMENTS`.
 */
export function departmentBreakdown(records: HRRecord[]): DeptAggregate[] {
  return DEPARTMENTS.map((department) => {
    const deptRecords = records.filter((r) => r.Department === department);
    const headcount = new Set(deptRecords.map((r) => r.EmployeeID)).size;
    return {
      department,
      totalPayroll: totalPayroll(deptRecords),
      totalOvertimeHours: totalOvertimeHours(deptRecords),
      totalOvertimePay: totalOvertimePay(deptRecords),
      headcount,
      avgSalary: headcount > 0 ? totalPayroll(deptRecords) / headcount : 0,
    };
  });
}

/**
 * Aggregated salary statistics for a single pay grade.
 *
 * - grade: Grade - which grade (G1-G5) this aggregate describes.
 * - avgSalary: number - mean MonthlySalary across the grade's records.
 * - minSalary: number - lowest MonthlySalary in the grade.
 * - maxSalary: number - highest MonthlySalary in the grade.
 * - count: number - number of records (not unique employees) in the grade.
 */
export interface GradeAggregate {
  grade: Grade;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  count: number;
}

/**
 * Builds a per-grade salary summary (average/min/max/count), one entry for
 * every grade in `GRADES`, used to power the "Compensation Distribution by
 * Grade" chart on the Payroll Dashboard.
 *
 * @param records - HRRecord[] - the rows to break down by grade.
 * @returns GradeAggregate[] - one aggregate object per grade, in the same order as `GRADES`.
 */
export function gradeCompensationDistribution(records: HRRecord[]): GradeAggregate[] {
  return GRADES.map((grade) => {
    const gradeRecords = records.filter((r) => r.Grade === grade);
    const salaries = gradeRecords.map((r) => r.MonthlySalary);
    return {
      grade,
      avgSalary: salaries.length ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0,
      minSalary: salaries.length ? Math.min(...salaries) : 0,
      maxSalary: salaries.length ? Math.max(...salaries) : 0,
      count: gradeRecords.length,
    };
  });
}

/**
 * A single bucket in the attrition-risk-score histogram.
 *
 * - label: string - human-readable bucket name (e.g. "Low", "High").
 * - range: string - the numeric range the bucket covers, for display (e.g. "76-100").
 * - count: number - number of records whose AttritionRiskScore falls in this bucket.
 */
export interface RiskBucket {
  label: string;
  range: string;
  count: number;
}

/**
 * Buckets every record into one of four fixed attrition-risk-score ranges
 * (Low/Moderate/Elevated/High), used to power the Attrition Risk Distribution
 * donut chart on the Payroll Dashboard.
 *
 * @param records - HRRecord[] - the rows to bucket by AttritionRiskScore.
 * @returns RiskBucket[] - always exactly 4 buckets (Low, Moderate, Elevated, High), in that order, each with its matching count.
 */
export function attritionRiskDistribution(records: HRRecord[]): RiskBucket[] {
  const buckets: RiskBucket[] = [
    { label: "Low", range: "1-25", count: 0 },
    { label: "Moderate", range: "26-50", count: 0 },
    { label: "Elevated", range: "51-75", count: 0 },
    { label: "High", range: "76-100", count: 0 },
  ];
  for (const r of records) {
    if (r.AttritionRiskScore <= 25) buckets[0].count++;
    else if (r.AttritionRiskScore <= 50) buckets[1].count++;
    else if (r.AttritionRiskScore <= 75) buckets[2].count++;
    else buckets[3].count++;
  }
  return buckets;
}

/**
 * A single bucket in the company-wide promotion-eligibility breakdown.
 *
 * - label: string - either "Eligible" or "Not Eligible".
 * - count: number - number of records that fall into this bucket.
 */
export interface EligibilityBucket {
  label: string;
  count: number;
}

/**
 * Splits every record into "Eligible" vs "Not Eligible" for promotion,
 * company-wide, used to power the Promotion Eligibility Distribution donut
 * chart on the Payroll Dashboard.
 *
 * @param records - HRRecord[] - the rows to split by PromotionEligible.
 * @returns EligibilityBucket[] - always exactly 2 buckets: [Eligible, Not Eligible].
 */
export function promotionEligibilityDistribution(records: HRRecord[]): EligibilityBucket[] {
  const eligible = records.filter((r) => r.PromotionEligible).length;
  return [
    { label: "Eligible", count: eligible },
    { label: "Not Eligible", count: records.length - eligible },
  ];
}

/**
 * Promotion-eligibility counts for a single department.
 *
 * - department: Department - which department this describes.
 * - eligible: number - count of records in the department with PromotionEligible === true.
 * - total: number - total record count in the department (eligible + not eligible).
 */
export interface DeptEligibility {
  department: Department;
  eligible: number;
  total: number;
}

/**
 * Builds a per-department promotion-eligibility breakdown, one entry for
 * every department in `DEPARTMENTS`, used in the Promotion Eligibility
 * Distribution card on the Payroll Dashboard.
 *
 * @param records - HRRecord[] - the rows to break down by department.
 * @returns DeptEligibility[] - one eligibility count per department, in the same order as `DEPARTMENTS`.
 */
export function departmentPromotionEligibility(records: HRRecord[]): DeptEligibility[] {
  return DEPARTMENTS.map((department) => {
    const deptRecords = records.filter((r) => r.Department === department);
    return {
      department,
      eligible: deptRecords.filter((r) => r.PromotionEligible).length,
      total: deptRecords.length,
    };
  });
}

/**
 * An HRRecord annotated with its total compensation (salary + overtime),
 * used for the "Top 10 Highest-Compensated Employees" ranking.
 *
 * - totalCompensation: number - MonthlySalary + OvertimePay for this record.
 */
export interface TopEmployee extends HRRecord {
  totalCompensation: number;
}

/**
 * Ranks records by total compensation (salary + overtime pay) and returns
 * the top `n`.
 *
 * @param records - HRRecord[] - the rows to rank.
 * @param n - number - how many top-paid records to return.
 * @returns TopEmployee[] - the `n` highest-paid records, sorted descending by totalCompensation, each annotated with its computed totalCompensation.
 */
export function topCompensated(records: HRRecord[], n: number): TopEmployee[] {
  return [...records]
    .map((r) => ({ ...r, totalCompensation: r.MonthlySalary + r.OvertimePay }))
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, n);
}

/**
 * Computes the statistical median of a list of numbers.
 *
 * @param values - number[] - the numbers to find the median of (need not be pre-sorted).
 * @returns number - the median value, or 0 if `values` is empty. For an even-length list, returns the average of the two middle values.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Computes the arithmetic mean (average) of a list of numbers.
 *
 * @param values - number[] - the numbers to average.
 * @returns number - the mean value, or 0 if `values` is empty (guards against a divide-by-zero).
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes the sample standard deviation of a list of numbers.
 *
 * @param values - number[] - the numbers to measure the spread of.
 * @returns number - the sample standard deviation, or 0 if `values` has fewer than 2 elements (standard deviation is undefined for 0 or 1 samples).
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
