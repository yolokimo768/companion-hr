import type { Department, HRRecord } from "../types";

/**
 * The set of policy levers a user can adjust on the Scenario Simulator page.
 *
 * - department: Department - which single department the salary-increase lever applies to.
 * - departmentSalaryIncreasePct: number - percentage salary bump applied only to `department`'s employees (e.g. 10 means +10%).
 * - overtimeReductionPct: number - percentage reduction applied to every employee's overtime pay, company-wide (e.g. 50 means overtime pay is halved).
 * - additionalHires: number - how many new employees to hypothetically add to `department`.
 * - globalAnnualRaisePct: number - percentage salary bump applied to every employee company-wide, on top of any department-specific increase.
 */
export interface ScenarioInputs {
  department: Department;
  departmentSalaryIncreasePct: number;
  overtimeReductionPct: number;
  additionalHires: number;
  globalAnnualRaisePct: number;
}

/**
 * The computed fiscal outcome of applying a set of `ScenarioInputs` to a
 * dataset, comparing the original (unmodified) budget against the simulated
 * one.
 *
 * - originalBudget: number - actual total monthly cost (salaries + overtime) before any scenario changes.
 * - simulatedBudget: number - projected total monthly cost after applying the scenario (salaries + overtime + new hire cost).
 * - netFiscalImpact: number - simulatedBudget minus originalBudget (positive = the scenario costs more per month).
 * - netFiscalImpactAnnualized: number - netFiscalImpact multiplied by 12, projecting the monthly delta across a full year.
 * - originalSalaryTotal: number - actual total base salaries before any scenario changes.
 * - originalOvertimeTotal: number - actual total overtime pay before any scenario changes.
 * - simulatedSalaryTotal: number - projected total base salaries after the scenario, including the cost of any additional hires.
 * - simulatedOvertimeTotal: number - projected total overtime pay after the scenario's overtime reduction is applied.
 * - newHiresCost: number - projected monthly salary cost of the hypothetical `additionalHires`.
 */
export interface ScenarioResult {
  originalBudget: number;
  simulatedBudget: number;
  netFiscalImpact: number;
  netFiscalImpactAnnualized: number;
  originalSalaryTotal: number;
  originalOvertimeTotal: number;
  simulatedSalaryTotal: number;
  simulatedOvertimeTotal: number;
  newHiresCost: number;
}

/**
 * Projects the fiscal impact of a compensation-policy scenario against a
 * dataset: applies a department-specific salary increase, a company-wide
 * overtime reduction, a company-wide annual raise, and the cost of
 * hypothetical new hires, then compares the resulting budget to the actual
 * one. This is pure client-side arithmetic — no data leaves the browser.
 *
 * @param records - HRRecord[] - the rows to simulate against (typically the currently-selected month's snapshot).
 * @param inputs - ScenarioInputs - the policy levers to apply; see `ScenarioInputs` for each field's meaning.
 * @returns ScenarioResult - the original vs. simulated budget breakdown; see `ScenarioResult` for each field's meaning.
 */
export function runScenario(
  records: HRRecord[],
  inputs: ScenarioInputs
): ScenarioResult {
  const {
    department,
    departmentSalaryIncreasePct,
    overtimeReductionPct,
    additionalHires,
    globalAnnualRaisePct,
  } = inputs;

  // Running totals accumulated across every record in a single pass.
  let originalSalaryTotal = 0;
  let originalOvertimeTotal = 0;
  let simulatedSalaryTotal = 0;
  let simulatedOvertimeTotal = 0;

  // Original (pre-scenario) salaries of employees in the target department,
  // used below to compute a representative salary for the hypothetical new hires.
  const departmentSalaries: number[] = [];

  for (const r of records) {
    originalSalaryTotal += r.MonthlySalary;
    originalOvertimeTotal += r.OvertimePay;

    let salary = r.MonthlySalary;
    if (r.Department === department) {
      salary *= 1 + departmentSalaryIncreasePct / 100;
      departmentSalaries.push(r.MonthlySalary);
    }
    salary *= 1 + globalAnnualRaisePct / 100;

    const overtimePay = r.OvertimePay * (1 - overtimeReductionPct / 100);

    simulatedSalaryTotal += salary;
    simulatedOvertimeTotal += overtimePay;
  }

  // Average pre-scenario salary within the target department, used as the
  // baseline salary for new hires. Falls back to a rough company-wide
  // placeholder (8500) if the department happened to have no records.
  const avgDepartmentSalary =
    departmentSalaries.length > 0
      ? departmentSalaries.reduce((a, b) => a + b, 0) / departmentSalaries.length
      : 8500;

  const newHireSalary = avgDepartmentSalary * (1 + departmentSalaryIncreasePct / 100) *
    (1 + globalAnnualRaisePct / 100);
  const newHiresCost = newHireSalary * additionalHires;

  const originalBudget = originalSalaryTotal + originalOvertimeTotal;
  const simulatedBudget = simulatedSalaryTotal + simulatedOvertimeTotal + newHiresCost;
  const netFiscalImpact = simulatedBudget - originalBudget;

  return {
    originalBudget,
    simulatedBudget,
    netFiscalImpact,
    netFiscalImpactAnnualized: netFiscalImpact * 12,
    originalSalaryTotal,
    originalOvertimeTotal,
    simulatedSalaryTotal: simulatedSalaryTotal + newHiresCost,
    simulatedOvertimeTotal,
    newHiresCost,
  };
}
