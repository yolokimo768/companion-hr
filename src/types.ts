/**
 * Union of every department that can appear in the HR dataset. Used to type
 * `HRRecord.Department` and to constrain any dropdown/filter that lets a user
 * pick a department, so a typo can never introduce a department that doesn't
 * actually exist in the data.
 */
export type Department =
  | "Engineering"
  | "Operations"
  | "Finance"
  | "Sales"
  | "Customer Success"
  | "HR";

/**
 * Union of every pay grade that can appear in the HR dataset, from G1 (most
 * junior) to G5 (most senior). Used to type `HRRecord.Grade`.
 */
export type Grade = "G1" | "G2" | "G3" | "G4" | "G5";

/**
 * Union of every month present in the synthetic dataset. The dataset only
 * covers a four-month window (Jan-Apr), so this type intentionally does not
 * include the rest of the calendar.
 */
export type MonthName = "Jan" | "Feb" | "Mar" | "Apr";

/**
 * A single row of the HR dataset: one employee's pay and performance snapshot
 * for one month. Every aggregation, chart, and AI recommendation in the app
 * is ultimately derived from arrays of this shape.
 *
 * Field types and meaning:
 * - EmployeeID: string - stable unique identifier for the employee (e.g. "EMP00123"), constant across all 4 months for the same person.
 * - Name: string - the employee's display name.
 * - Department: Department - which of the 6 departments the employee belongs to.
 * - Grade: Grade - the employee's pay grade (G1-G5).
 * - MonthlySalary: number - base monthly salary in dollars for this month (excludes overtime).
 * - OvertimeHours: number - hours of overtime logged in this month.
 * - OvertimePay: number - dollar amount paid for the overtime hours in this month.
 * - PerformanceRating: number - performance score on a 1.0-5.0 scale for this month.
 * - AttritionRiskScore: number - modeled likelihood of the employee leaving, on a 1-100 scale.
 * - PromotionEligible: boolean - whether the employee currently qualifies for promotion.
 * - Month: MonthName - which month this snapshot row represents.
 */
export interface HRRecord {
  EmployeeID: string;
  Name: string;
  Department: Department;
  Grade: Grade;
  MonthlySalary: number;
  OvertimeHours: number;
  OvertimePay: number;
  PerformanceRating: number;
  AttritionRiskScore: number;
  PromotionEligible: boolean;
  Month: MonthName;
}

/**
 * The canonical chronological ordering of the months present in the dataset.
 * Anything that needs to compare "this month vs. the previous month" (trend
 * banners, the AI HR Summary narrative, etc.) looks up an index in this array
 * rather than relying on calendar logic, since the dataset only spans Jan-Apr.
 */
export const MONTH_ORDER: MonthName[] = ["Jan", "Feb", "Mar", "Apr"];

/**
 * The canonical list of all 6 departments, in the order they should be
 * displayed in tables, dropdowns, and charts throughout the app.
 */
export const DEPARTMENTS: Department[] = [
  "Engineering",
  "Operations",
  "Finance",
  "Sales",
  "Customer Success",
  "HR",
];

/**
 * The canonical list of all 5 pay grades, in the order they should be
 * displayed in tables, dropdowns, and charts throughout the app.
 */
export const GRADES: Grade[] = ["G1", "G2", "G3", "G4", "G5"];
