import type { HRRecord, MonthName } from "../types";
import { DEPARTMENTS, GRADES, MONTH_ORDER } from "../types";
import { mean, median } from "./aggregate";

interface MonthDeptSlice {
  department: string;
  headcount: number;
  totalPayroll: number;
  avgSalary: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  avgPerformanceRating: number;
  avgAttritionRisk: number;
  promotionEligibleCount: number;
}

interface DataDigest {
  totalRecords: number;
  uniqueEmployees: number;
  departments: string[];
  grades: string[];
  monthsCovered: MonthName[];
  byMonth: Record<string, MonthDeptSlice[]>;
  gradeSalary: { grade: string; avgSalary: number; medianSalary: number; count: number }[];
  notable: {
    highestPaid: { name: string; department: string; grade: string; salary: number; month: string };
    highestAttritionRisk: { name: string; department: string; riskScore: number; month: string };
    topPerformer: { name: string; department: string; rating: number; month: string };
  } | null;
}

export function buildDataDigest(records: HRRecord[]): string {
  if (records.length === 0) {
    return JSON.stringify({ totalRecords: 0, note: "No data loaded." });
  }

  const monthsPresent = MONTH_ORDER.filter((m) => records.some((r) => r.Month === m));

  const byMonth: Record<string, MonthDeptSlice[]> = {};
  for (const month of monthsPresent) {
    const monthRecords = records.filter((r) => r.Month === month);
    byMonth[month] = DEPARTMENTS.map((department) => {
      const deptRecords = monthRecords.filter((r) => r.Department === department);
      const headcount = deptRecords.length;
      const totalPayroll = deptRecords.reduce((s, r) => s + r.MonthlySalary, 0);
      return {
        department,
        headcount,
        totalPayroll: Math.round(totalPayroll),
        avgSalary: headcount ? Math.round(totalPayroll / headcount) : 0,
        totalOvertimeHours: deptRecords.reduce((s, r) => s + r.OvertimeHours, 0),
        totalOvertimePay: Math.round(deptRecords.reduce((s, r) => s + r.OvertimePay, 0)),
        avgPerformanceRating: Number(mean(deptRecords.map((r) => r.PerformanceRating)).toFixed(2)),
        avgAttritionRisk: Number(mean(deptRecords.map((r) => r.AttritionRiskScore)).toFixed(1)),
        promotionEligibleCount: deptRecords.filter((r) => r.PromotionEligible).length,
      };
    }).filter((d) => d.headcount > 0);
  }

  const gradeSalary = GRADES.map((grade) => {
    const gradeRecords = records.filter((r) => r.Grade === grade);
    const salaries = gradeRecords.map((r) => r.MonthlySalary);
    return {
      grade,
      avgSalary: Math.round(mean(salaries)),
      medianSalary: Math.round(median(salaries)),
      count: gradeRecords.length,
    };
  });

  const highestPaidRecord = [...records].sort((a, b) => b.MonthlySalary - a.MonthlySalary)[0];
  const highestRiskRecord = [...records].sort((a, b) => b.AttritionRiskScore - a.AttritionRiskScore)[0];
  const topPerformerRecord = [...records].sort((a, b) => b.PerformanceRating - a.PerformanceRating)[0];

  const digest: DataDigest = {
    totalRecords: records.length,
    uniqueEmployees: new Set(records.map((r) => r.EmployeeID)).size,
    departments: DEPARTMENTS,
    grades: GRADES,
    monthsCovered: monthsPresent,
    byMonth,
    gradeSalary,
    notable: {
      highestPaid: {
        name: highestPaidRecord.Name,
        department: highestPaidRecord.Department,
        grade: highestPaidRecord.Grade,
        salary: highestPaidRecord.MonthlySalary,
        month: highestPaidRecord.Month,
      },
      highestAttritionRisk: {
        name: highestRiskRecord.Name,
        department: highestRiskRecord.Department,
        riskScore: highestRiskRecord.AttritionRiskScore,
        month: highestRiskRecord.Month,
      },
      topPerformer: {
        name: topPerformerRecord.Name,
        department: topPerformerRecord.Department,
        rating: topPerformerRecord.PerformanceRating,
        month: topPerformerRecord.Month,
      },
    },
  };

  return JSON.stringify(digest);
}

export function findEmployeeRecords(records: HRRecord[], query: string): HRRecord[] {
  const q = query.toLowerCase().trim();
  const idMatch = q.match(/\bemp\d+\b/i);
  if (idMatch) {
    const id = idMatch[0].toUpperCase();
    return records.filter((r) => r.EmployeeID === id);
  }
  const nameMatch = q.match(
    /(?:who is|tell me about|info(?:rmation)? on|profile (?:for|of)|details (?:on|about))\s+([a-z][a-z\s]{1,40}?)(?:\?|$)/
  );
  if (nameMatch) {
    const namePart = nameMatch[1].trim();
    if (namePart.length >= 3) {
      return records.filter((r) => r.Name.toLowerCase().includes(namePart));
    }
  }
  return [];
}
