import type { Department, HRRecord } from "../types";
import { DEPARTMENTS } from "../types";
import { mean } from "./aggregate";
import {
  getPromotionCandidates,
  getRetentionRiskEmployees,
  getLowCompensationEmployees,
  getOvertimeSpikesByDepartment,
  type LowCompEmployee,
} from "./categories";

// Standard full-time monthly capacity (~40 hrs/week x ~4.33 weeks). Dividing a
// department's overtime hours by this yields the FTE-equivalent gap: how many
// additional hires would be needed to absorb that overtime as regular hours.
const STANDARD_MONTHLY_HOURS = 173;

/**
 * Ranks promotion-eligible employees by performance rating and returns the
 * top `limit`, for the "Employees Recommended for Promotion" list on the AI
 * Recommendations page.
 *
 * @param records - HRRecord[] - the rows to rank (typically the currently-selected month's records).
 * @param limit - number (default 10) - maximum number of employees to return.
 * @returns HRRecord[] - up to `limit` promotion-eligible employees, highest-rated first.
 */
export function getTopPromotionRecommendations(records: HRRecord[], limit = 10): HRRecord[] {
  return getPromotionCandidates(records).slice(0, limit);
}

/**
 * Ranks high performers with elevated attrition risk and returns the top
 * `limit`, for the "Employees Requiring Retention Plans" list on the AI
 * Recommendations page.
 *
 * @param records - HRRecord[] - the rows to rank.
 * @param limit - number (default 10) - maximum number of employees to return.
 * @returns HRRecord[] - up to `limit` retention-risk employees, highest attrition risk first.
 */
export function getTopRetentionRecommendations(records: HRRecord[], limit = 10): HRRecord[] {
  return getRetentionRiskEmployees(records).slice(0, limit);
}

/**
 * Ranks employees paid furthest below their grade's median salary and
 * returns the top `limit`, for the "Potential Compensation Adjustments" list
 * on the AI Recommendations page.
 *
 * @param records - HRRecord[] - the rows to rank.
 * @param limit - number (default 10) - maximum number of employees to return.
 * @returns LowCompEmployee[] - up to `limit` underpaid employees, largest gap below their grade median first.
 */
export function getTopCompensationAdjustments(records: HRRecord[], limit = 10): LowCompEmployee[] {
  return getLowCompensationEmployees(records).slice(0, limit);
}

/**
 * A single department's overtime burden and the suggested headcount increase
 * to relieve it, shown in the "Departments Requiring Hiring" list on the AI
 * Recommendations page.
 *
 * - department: Department - which department this recommendation is for.
 * - headcount: number - number of employee records in the department.
 * - avgOvertimeHours: number - mean overtime hours per employee in the department.
 * - totalOvertimeHours: number - summed overtime hours across the department.
 * - totalOvertimePay: number - summed overtime pay across the department.
 * - overtimeSpikeCount: number - number of employees in the department flagged as individual overtime spikes.
 * - suggestedHires: number - estimated number of additional hires needed to absorb the department's overtime hours as regular capacity (see STANDARD_MONTHLY_HOURS).
 */
export interface DepartmentHiringRecommendation {
  department: Department;
  headcount: number;
  avgOvertimeHours: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  overtimeSpikeCount: number;
  suggestedHires: number;
}

/**
 * Identifies departments running above-average overtime per employee — a
 * signal that headcount hasn't kept pace with workload — and estimates how
 * many additional hires would be needed to absorb that overtime as regular
 * working hours instead.
 *
 * @param records - HRRecord[] - the rows to analyze (typically the currently-selected month's records; the company-wide average overtime is computed from this same set).
 * @param limit - number (default 10) - maximum number of departments to return (in practice capped at 6, since there are only 6 departments).
 * @returns DepartmentHiringRecommendation[] - departments whose average overtime per employee exceeds the company-wide average, sorted highest-burden first.
 */
export function getDepartmentHiringRecommendations(
  records: HRRecord[],
  limit = 10
): DepartmentHiringRecommendation[] {
  if (records.length === 0) return [];

  const companyAvgOvertime = mean(records.map((r) => r.OvertimeHours));
  // Number of distinct months represented in `records`, used to normalize the
  // suggested-hire estimate so it doesn't scale up when "All Months" is selected.
  const monthsCount = new Set(records.map((r) => r.Month)).size || 1;
  const spikesByDept = new Map(getOvertimeSpikesByDepartment(records).map((d) => [d.department, d.count]));

  return DEPARTMENTS.map((department) => {
    const deptRecords = records.filter((r) => r.Department === department);
    const headcount = deptRecords.length;
    const totalOvertimeHours = deptRecords.reduce((s, r) => s + r.OvertimeHours, 0);
    const totalOvertimePay = deptRecords.reduce((s, r) => s + r.OvertimePay, 0);
    const avgOvertimeHours = headcount > 0 ? totalOvertimeHours / headcount : 0;
    return {
      department,
      headcount,
      avgOvertimeHours,
      totalOvertimeHours,
      totalOvertimePay,
      overtimeSpikeCount: spikesByDept.get(department) ?? 0,
      suggestedHires: Math.max(1, Math.round(totalOvertimeHours / monthsCount / STANDARD_MONTHLY_HOURS)),
    };
  })
    .filter((d) => d.headcount > 0 && d.avgOvertimeHours > companyAvgOvertime)
    .sort((a, b) => b.avgOvertimeHours - a.avgOvertimeHours)
    .slice(0, limit);
}
