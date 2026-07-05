import type { Department, HRRecord, MonthName } from "../types";
import { DEPARTMENTS, MONTH_ORDER } from "../types";

/** AttritionRiskScore threshold (1-100) above which an employee counts toward a department's "elevated risk" share in the narrative. */
const ATTRITION_HIGH_THRESHOLD = 75;

/**
 * The change in a single metric for one department between two months.
 *
 * - department: Department - which department this delta describes.
 * - current: number - the metric's value in the "current" month.
 * - prev: number - the metric's value in the prior month.
 * - delta: number - current minus prev (positive = the metric grew).
 */
interface DeptDelta {
  department: Department;
  current: number;
  prev: number;
  delta: number;
}

/**
 * Computes a month-over-month delta of an arbitrary metric, broken down by
 * department. Used internally to find which department drove the biggest
 * change in overtime hours or headcount.
 *
 * @param current - HRRecord[] - the "current" month's rows.
 * @param prev - HRRecord[] - the prior month's rows.
 * @param metric - (rs: HRRecord[]) => number - a function that reduces a set of records to a single number (e.g. total overtime hours, or headcount).
 * @returns DeptDelta[] - one delta per department in `DEPARTMENTS`, regardless of whether the delta is positive, negative, or zero.
 */
function deptDeltas(
  current: HRRecord[],
  prev: HRRecord[],
  metric: (rs: HRRecord[]) => number
): DeptDelta[] {
  return DEPARTMENTS.map((department) => {
    const c = metric(current.filter((r) => r.Department === department));
    const p = metric(prev.filter((r) => r.Department === department));
    return { department, current: c, prev: p, delta: c - p };
  });
}

/**
 * The generated "AI HR Summary" narrative shown on the Executive Summary
 * page: a few plain-English sentences describing what changed company-wide
 * between two consecutive months.
 *
 * - month: MonthName - the "current" month the narrative is describing.
 * - prevMonth: MonthName - the prior month used as the comparison baseline.
 * - sentences: string[] - the generated narrative, one string per sentence/topic (payroll trend, attrition risk, promotion pipeline).
 */
export interface NarrativeSummary {
  month: MonthName;
  prevMonth: MonthName;
  sentences: string[];
}

/**
 * Generates a short, plain-English, data-driven narrative summarizing the
 * company's month-over-month HR posture: how total payroll changed and why
 * (attributing it to the department with the biggest overtime increase and
 * the department with the biggest headcount increase), which department has
 * the highest share of employees at elevated attrition risk, and how large
 * the promotion-eligible pipeline is. This is entirely local, rule-based
 * text generation over the dataset — it does not call any AI/LLM API.
 *
 * @param allRecords - HRRecord[] - the full unfiltered dataset (both the comparison months must be present in it, regardless of any UI month filter).
 * @param selectedMonth - MonthName | "All" - the month currently selected in the UI; if "All", the narrative falls back to the most recent month present in the data.
 * @returns NarrativeSummary | null - the generated narrative, or null if there isn't at least two consecutive months of data to compare (e.g. only Jan is loaded, or the dataset is empty).
 */
export function buildNarrativeSummary(
  allRecords: HRRecord[],
  selectedMonth: MonthName | "All"
): NarrativeSummary | null {
  if (allRecords.length === 0) return null;

  const monthsPresent = MONTH_ORDER.filter((m) => allRecords.some((r) => r.Month === m));
  if (monthsPresent.length < 2) return null;

  const month = selectedMonth === "All" ? monthsPresent[monthsPresent.length - 1] : selectedMonth;
  const idx = MONTH_ORDER.indexOf(month);
  if (idx <= 0) return null;

  const prevMonth = MONTH_ORDER[idx - 1];
  if (!monthsPresent.includes(prevMonth)) return null;

  const current = allRecords.filter((r) => r.Month === month);
  const prev = allRecords.filter((r) => r.Month === prevMonth);
  if (current.length === 0 || prev.length === 0) return null;

  // --- Sentence 1: total payroll trend and its top two departmental drivers. ---
  const totalPayrollCurrent = current.reduce((s, r) => s + r.MonthlySalary, 0);
  const totalPayrollPrev = prev.reduce((s, r) => s + r.MonthlySalary, 0);
  const payrollPctChange =
    totalPayrollPrev !== 0 ? ((totalPayrollCurrent - totalPayrollPrev) / totalPayrollPrev) * 100 : 0;

  const overtimeDriver = deptDeltas(current, prev, (rs) => rs.reduce((s, r) => s + r.OvertimeHours, 0))
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];

  const hiringDriver = deptDeltas(current, prev, (rs) => rs.length)
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];

  const direction = payrollPctChange >= 0 ? "increased" : "decreased";
  const absChange = Math.abs(payrollPctChange).toFixed(1);

  const drivers: string[] = [];
  if (overtimeDriver) drivers.push(`overtime growth in ${overtimeDriver.department}`);
  if (hiringDriver && hiringDriver.department !== overtimeDriver?.department) {
    drivers.push(
      `new hiring in ${hiringDriver.department} (+${hiringDriver.delta} employee${hiringDriver.delta === 1 ? "" : "s"})`
    );
  }

  const sentence1 =
    drivers.length > 0
      ? `Total payroll ${direction} by ${absChange}% month-over-month (${prevMonth} → ${month}), primarily due to ${drivers.join(" and ")}.`
      : `Total payroll ${direction} by ${absChange}% month-over-month (${prevMonth} → ${month}) across a broadly stable headcount and overtime footprint.`;

  // --- Sentence 2: which department has the highest share of at-risk employees. ---
  const attritionByDept = DEPARTMENTS.map((department) => {
    const deptRecords = current.filter((r) => r.Department === department);
    const highRisk = deptRecords.filter((r) => r.AttritionRiskScore > ATTRITION_HIGH_THRESHOLD);
    return {
      department,
      pct: deptRecords.length > 0 ? (highRisk.length / deptRecords.length) * 100 : 0,
    };
  }).sort((a, b) => b.pct - a.pct)[0];

  const sentence2 =
    attritionByDept && attritionByDept.pct > 0
      ? `Attrition risk remains most elevated in ${attritionByDept.department}, where ${attritionByDept.pct.toFixed(
          0
        )}% of employees have risk scores above ${ATTRITION_HIGH_THRESHOLD}.`
      : `No department currently shows a concentration of employees with attrition risk scores above ${ATTRITION_HIGH_THRESHOLD}.`;

  // --- Sentence 3: size and concentration of the promotion-eligible pipeline. ---
  const totalPromotionEligible = current.filter((r) => r.PromotionEligible).length;
  const topPromotionDept = DEPARTMENTS.map((department) => ({
    department,
    count: current.filter((r) => r.Department === department && r.PromotionEligible).length,
  })).sort((a, b) => b.count - a.count)[0];

  const sentence3 =
    totalPromotionEligible > 0 && topPromotionDept && topPromotionDept.count > 0
      ? `${totalPromotionEligible} employees company-wide are currently promotion-eligible, with the largest concentration in ${topPromotionDept.department} (${topPromotionDept.count}).`
      : `No employees are currently flagged as promotion-eligible for ${month}.`;

  return { month, prevMonth, sentences: [sentence1, sentence2, sentence3] };
}
