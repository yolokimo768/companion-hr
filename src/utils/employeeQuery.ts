import type { HRRecord } from "../types";

export interface EmployeeQueryFilters {
  employeeId?: string;
  nameContains?: string;
  department?: string;
  location?: string;
  grade?: string;
  month?: string;
  minPerformanceRating?: number;
  maxPerformanceRating?: number;
  minSalary?: number;
  maxSalary?: number;
  minAttritionRisk?: number;
  maxAttritionRisk?: number;
  minOvertimeHours?: number;
  maxOvertimeHours?: number;
  minAbsenceDays?: number;
  maxAbsenceDays?: number;
  promotionEligible?: boolean;
  sortBy?: "MonthlySalary" | "PerformanceRating" | "AttritionRiskScore" | "OvertimeHours" | "AbsenceDays";
  sortDirection?: "asc" | "desc";
  limit?: number;
}

export const QUERY_EMPLOYEES_TOOL_NAME = "query_employees";

export const queryEmployeesToolDefinition = {
  name: QUERY_EMPLOYEES_TOOL_NAME,
  description:
    "Search the full HR dataset (25,000 monthly employee records) with filters and return matching rows. Use this for anything the aggregated digest doesn't cover: cross-tabulating multiple fields (e.g. high performance rating AND low salary), comparing offices/locations, attendance/absence questions, listing or counting specific employees, looking up a person by name or ID, or any precise row-level question. Combine multiple filters in one call to answer compound questions. Returns up to `limit` matching rows plus the total match count.",
  input_schema: {
    type: "object" as const,
    properties: {
      employeeId: { type: "string", description: "Exact employee ID, e.g. EMP00123." },
      nameContains: { type: "string", description: "Case-insensitive substring match on employee name." },
      department: { type: "string", description: "Exact department name." },
      location: { type: "string", description: "Exact office/location name, e.g. 'New York', 'Remote'." },
      grade: { type: "string", description: "Exact grade, G1-G5." },
      month: { type: "string", description: "Exact month: Jan, Feb, Mar, or Apr." },
      minPerformanceRating: { type: "number", description: "Minimum performance rating (1.0-5.0)." },
      maxPerformanceRating: { type: "number", description: "Maximum performance rating (1.0-5.0)." },
      minSalary: { type: "number", description: "Minimum monthly salary in dollars." },
      maxSalary: { type: "number", description: "Maximum monthly salary in dollars." },
      minAttritionRisk: { type: "number", description: "Minimum attrition risk score (1-100)." },
      maxAttritionRisk: { type: "number", description: "Maximum attrition risk score (1-100)." },
      minOvertimeHours: { type: "number", description: "Minimum overtime hours." },
      maxOvertimeHours: { type: "number", description: "Maximum overtime hours." },
      minAbsenceDays: { type: "number", description: "Minimum absence days logged that month. Use this for attendance-issue questions (e.g. 5+ days)." },
      maxAbsenceDays: { type: "number", description: "Maximum absence days logged that month." },
      promotionEligible: { type: "boolean", description: "Filter to promotion-eligible (true) or not (false)." },
      sortBy: {
        type: "string",
        description: "Field to sort by: MonthlySalary, PerformanceRating, AttritionRiskScore, OvertimeHours, or AbsenceDays.",
      },
      sortDirection: { type: "string", description: "'asc' or 'desc'. Default 'desc'." },
      limit: { type: "number", description: "Max rows to return. Default 20, max 100." },
    },
  },
};

export interface EmployeeQueryResult {
  totalMatches: number;
  returnedCount: number;
  truncated: boolean;
  employees: Array<Record<string, string | number | boolean>>;
}

export function runEmployeeQuery(records: HRRecord[], filters: EmployeeQueryFilters): EmployeeQueryResult {
  let results = records.filter((r) => {
    if (filters.employeeId && r.EmployeeID !== filters.employeeId) return false;
    if (filters.nameContains && !r.Name.toLowerCase().includes(filters.nameContains.toLowerCase())) return false;
    if (filters.department && r.Department !== filters.department) return false;
    if (filters.location && r.Location !== filters.location) return false;
    if (filters.grade && r.Grade !== filters.grade) return false;
    if (filters.month && r.Month !== filters.month) return false;
    if (filters.minPerformanceRating !== undefined && r.PerformanceRating < filters.minPerformanceRating) return false;
    if (filters.maxPerformanceRating !== undefined && r.PerformanceRating > filters.maxPerformanceRating) return false;
    if (filters.minSalary !== undefined && r.MonthlySalary < filters.minSalary) return false;
    if (filters.maxSalary !== undefined && r.MonthlySalary > filters.maxSalary) return false;
    if (filters.minAttritionRisk !== undefined && r.AttritionRiskScore < filters.minAttritionRisk) return false;
    if (filters.maxAttritionRisk !== undefined && r.AttritionRiskScore > filters.maxAttritionRisk) return false;
    if (filters.minOvertimeHours !== undefined && r.OvertimeHours < filters.minOvertimeHours) return false;
    if (filters.maxOvertimeHours !== undefined && r.OvertimeHours > filters.maxOvertimeHours) return false;
    if (filters.minAbsenceDays !== undefined && r.AbsenceDays < filters.minAbsenceDays) return false;
    if (filters.maxAbsenceDays !== undefined && r.AbsenceDays > filters.maxAbsenceDays) return false;
    if (filters.promotionEligible !== undefined && r.PromotionEligible !== filters.promotionEligible) return false;
    return true;
  });

  if (filters.sortBy) {
    const sortKey = filters.sortBy;
    const dir = filters.sortDirection === "asc" ? 1 : -1;
    results = [...results].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }

  const totalMatches = results.length;
  const limit = Math.min(filters.limit ?? 20, 100);
  const sliced = results.slice(0, limit);

  return {
    totalMatches,
    returnedCount: sliced.length,
    truncated: totalMatches > sliced.length,
    employees: sliced.map((r) => ({
      EmployeeID: r.EmployeeID,
      Name: r.Name,
      Department: r.Department,
      Location: r.Location,
      Grade: r.Grade,
      Month: r.Month,
      MonthlySalary: r.MonthlySalary,
      OvertimeHours: r.OvertimeHours,
      OvertimePay: r.OvertimePay,
      AbsenceDays: r.AbsenceDays,
      PerformanceRating: r.PerformanceRating,
      AttritionRiskScore: r.AttritionRiskScore,
      PromotionEligible: r.PromotionEligible,
    })),
  };
}
