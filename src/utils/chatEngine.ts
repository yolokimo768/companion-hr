import type { Department, Grade, HRRecord, MonthName } from "../types";
import { DEPARTMENTS, GRADES, MONTH_ORDER } from "../types";
import { formatCurrency, formatNumber } from "./format";
import { mean, median } from "./aggregate";

const MONTH_ALIASES: Record<string, MonthName> = {
  jan: "Jan", january: "Jan",
  feb: "Feb", february: "Feb",
  mar: "Mar", march: "Mar",
  apr: "Apr", april: "Apr",
};

// Scope filters narrow *which population* we're looking at (department/grade/month).
interface ScopeFilters {
  department?: Department;
  grade?: Grade;
  month?: MonthName;
}

// Condition filters describe a *trait* within that population (used for percentage
// questions, where we need the population both with and without the condition applied).
interface ConditionFilters {
  promotionEligible?: boolean;
  minSalary?: number;
  maxSalary?: number;
  minRisk?: number;
  maxRisk?: number;
  minRating?: number;
  maxRating?: number;
  minOvertime?: number;
  maxOvertime?: number;
}

type Filters = ScopeFilters & ConditionFilters;

function extractThreshold(q: string, metricPattern: string): { min?: number; max?: number } {
  const result: { min?: number; max?: number } = {};
  const aboveFwd = q.match(
    new RegExp(`(?:${metricPattern})[a-z\\s]{0,12}?(?:above|over|greater than|more than|at least|higher than)\\s*\\$?(\\d+(?:\\.\\d+)?)`)
  );
  const aboveRev = q.match(
    new RegExp(`(?:above|over|greater than|more than|at least|higher than)\\s*\\$?(\\d+(?:\\.\\d+)?)[a-z\\s]{0,12}?(?:${metricPattern})`)
  );
  const match = aboveFwd ?? aboveRev;
  if (match) result.min = parseFloat(match[1]);

  const belowFwd = q.match(
    new RegExp(`(?:${metricPattern})[a-z\\s]{0,12}?(?:below|under|less than|at most|lower than)\\s*\\$?(\\d+(?:\\.\\d+)?)`)
  );
  const belowRev = q.match(
    new RegExp(`(?:below|under|less than|at most|lower than)\\s*\\$?(\\d+(?:\\.\\d+)?)[a-z\\s]{0,12}?(?:${metricPattern})`)
  );
  const belowMatch = belowFwd ?? belowRev;
  if (belowMatch) result.max = parseFloat(belowMatch[1]);

  return result;
}

function parseFilters(q: string): Filters {
  const filters: Filters = {};

  for (const dept of DEPARTMENTS) {
    if (q.includes(dept.toLowerCase())) {
      filters.department = dept;
      break;
    }
  }
  if (!filters.department) {
    if (/\beng(ineering)?\b/.test(q)) filters.department = "Engineering";
    else if (/\bops\b|\boperations\b/.test(q)) filters.department = "Operations";
    else if (/\bfinance\b/.test(q)) filters.department = "Finance";
    else if (/\bsales\b/.test(q)) filters.department = "Sales";
    else if (/customer success|\bcs\b|\bcx\b/.test(q)) filters.department = "Customer Success";
    else if (/\bhr\b|human resources/.test(q)) filters.department = "HR";
  }

  for (const grade of GRADES) {
    if (new RegExp(`\\b${grade.toLowerCase()}\\b`).test(q)) {
      filters.grade = grade;
      break;
    }
  }

  for (const [alias, month] of Object.entries(MONTH_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(q)) {
      filters.month = month;
      break;
    }
  }

  if (/not (promotion )?eligible|ineligible|not qualif/.test(q)) {
    filters.promotionEligible = false;
  } else if (/promotion eligible|eligible for promotion|qualif(?:y|ied) for promotion/.test(q)) {
    filters.promotionEligible = true;
  }

  const riskThreshold = extractThreshold(q, "risk|attrition");
  if (riskThreshold.min !== undefined) filters.minRisk = riskThreshold.min;
  if (riskThreshold.max !== undefined) filters.maxRisk = riskThreshold.max;
  if (filters.minRisk === undefined && filters.maxRisk === undefined) {
    if (/high (?:attrition )?risk/.test(q)) filters.minRisk = 76;
    else if (/low (?:attrition )?risk/.test(q)) filters.maxRisk = 25;
  }

  const salaryThreshold = extractThreshold(q, "salary|pay|compensation");
  if (salaryThreshold.min !== undefined) filters.minSalary = salaryThreshold.min;
  if (salaryThreshold.max !== undefined) filters.maxSalary = salaryThreshold.max;

  const ratingThreshold = extractThreshold(q, "rating|performance");
  if (ratingThreshold.min !== undefined) filters.minRating = ratingThreshold.min;
  if (ratingThreshold.max !== undefined) filters.maxRating = ratingThreshold.max;

  const overtimeThreshold = extractThreshold(q, "overtime");
  if (overtimeThreshold.min !== undefined) filters.minOvertime = overtimeThreshold.min;
  if (overtimeThreshold.max !== undefined) filters.maxOvertime = overtimeThreshold.max;

  return filters;
}

function applyScopeFilters(records: HRRecord[], f: ScopeFilters): HRRecord[] {
  return records.filter((r) => {
    if (f.department && r.Department !== f.department) return false;
    if (f.grade && r.Grade !== f.grade) return false;
    if (f.month && r.Month !== f.month) return false;
    return true;
  });
}

function applyConditionFilters(records: HRRecord[], f: ConditionFilters): HRRecord[] {
  return records.filter((r) => {
    if (f.promotionEligible !== undefined && r.PromotionEligible !== f.promotionEligible) return false;
    if (f.minSalary !== undefined && r.MonthlySalary < f.minSalary) return false;
    if (f.maxSalary !== undefined && r.MonthlySalary > f.maxSalary) return false;
    if (f.minRisk !== undefined && r.AttritionRiskScore < f.minRisk) return false;
    if (f.maxRisk !== undefined && r.AttritionRiskScore > f.maxRisk) return false;
    if (f.minRating !== undefined && r.PerformanceRating < f.minRating) return false;
    if (f.maxRating !== undefined && r.PerformanceRating > f.maxRating) return false;
    if (f.minOvertime !== undefined && r.OvertimeHours < f.minOvertime) return false;
    if (f.maxOvertime !== undefined && r.OvertimeHours > f.maxOvertime) return false;
    return true;
  });
}

function scopeLabel(f: Filters): string {
  const parts: string[] = [];
  if (f.department) parts.push(f.department);
  if (f.grade) parts.push(f.grade);
  if (f.month) parts.push(f.month);
  if (f.promotionEligible === true) parts.push("promotion eligible");
  if (f.promotionEligible === false) parts.push("not promotion eligible");
  if (f.minRisk !== undefined) parts.push(`risk ≥ ${f.minRisk}`);
  if (f.maxRisk !== undefined) parts.push(`risk ≤ ${f.maxRisk}`);
  if (f.minSalary !== undefined) parts.push(`salary ≥ ${formatCurrency(f.minSalary)}`);
  if (f.maxSalary !== undefined) parts.push(`salary ≤ ${formatCurrency(f.maxSalary)}`);
  if (f.minRating !== undefined) parts.push(`rating ≥ ${f.minRating}`);
  if (f.maxRating !== undefined) parts.push(`rating ≤ ${f.maxRating}`);
  if (f.minOvertime !== undefined) parts.push(`OT ≥ ${f.minOvertime}h`);
  if (f.maxOvertime !== undefined) parts.push(`OT ≤ ${f.maxOvertime}h`);
  return parts.length > 0 ? ` in ${parts.join(" / ")}` : " across the whole dataset";
}

function employeeProfileText(r: HRRecord): string {
  return [
    `${r.Name} (${r.EmployeeID}) — ${r.Department}, ${r.Grade}, ${r.Month} snapshot`,
    `• Monthly Salary: ${formatCurrency(r.MonthlySalary)}`,
    `• Overtime: ${r.OvertimeHours} hrs (${formatCurrency(r.OvertimePay)})`,
    `• Total Compensation: ${formatCurrency(r.MonthlySalary + r.OvertimePay)}`,
    `• Performance Rating: ${r.PerformanceRating.toFixed(1)} / 5.0`,
    `• Attrition Risk: ${r.AttritionRiskScore} / 100`,
    `• Promotion Eligible: ${r.PromotionEligible ? "Yes" : "No"}`,
  ].join("\n");
}

const LIST_TRIGGER = /\b(list|show me|show all|who are|which employees|give me a list)\b/;

function metricSort(q: string, rows: HRRecord[]): { sorted: HRRecord[]; describe: (r: HRRecord) => string } {
  if (/overtime/.test(q)) {
    return {
      sorted: [...rows].sort((a, b) => b.OvertimeHours - a.OvertimeHours),
      describe: (r) => `${r.OvertimeHours} hrs OT`,
    };
  }
  if (/risk|attrition/.test(q)) {
    return {
      sorted: [...rows].sort((a, b) => b.AttritionRiskScore - a.AttritionRiskScore),
      describe: (r) => `risk ${r.AttritionRiskScore}/100`,
    };
  }
  if (/rating|performance/.test(q)) {
    return {
      sorted: [...rows].sort((a, b) => b.PerformanceRating - a.PerformanceRating),
      describe: (r) => `rating ${r.PerformanceRating.toFixed(1)}`,
    };
  }
  return {
    sorted: [...rows].sort((a, b) => b.MonthlySalary - a.MonthlySalary),
    describe: (r) => formatCurrency(r.MonthlySalary),
  };
}

function departmentMetric(q: string): { fn: (recs: HRRecord[]) => number; label: string; format: (v: number) => string } {
  if (/overtime/.test(q)) {
    return { fn: (recs) => recs.reduce((s, r) => s + r.OvertimeHours, 0), label: "total overtime hours", format: (v) => `${formatNumber(v)} hrs` };
  }
  if (/attrition|risk/.test(q)) {
    return { fn: (recs) => mean(recs.map((r) => r.AttritionRiskScore)), label: "average attrition risk", format: (v) => `${v.toFixed(1)}/100` };
  }
  if (/headcount|employees/.test(q)) {
    return { fn: (recs) => new Set(recs.map((r) => r.EmployeeID)).size, label: "headcount", format: (v) => formatNumber(v) };
  }
  if (/eligible|promotion/.test(q)) {
    return { fn: (recs) => recs.filter((r) => r.PromotionEligible).length, label: "promotion-eligible count", format: (v) => formatNumber(v) };
  }
  return { fn: (recs) => recs.reduce((s, r) => s + r.MonthlySalary, 0), label: "total payroll", format: (v) => formatCurrency(v) };
}

export interface ChatAnswer {
  text: string;
}

export function answerQuery(query: string, allRecords: HRRecord[]): ChatAnswer {
  const q = query.toLowerCase().trim();
  if (allRecords.length === 0) {
    return { text: "No data is loaded yet — upload a CSV to get started." };
  }

  const filters = parseFilters(q);
  const scopeOnly: ScopeFilters = { department: filters.department, grade: filters.grade, month: filters.month };
  const basePopulation = applyScopeFilters(allRecords, scopeOnly);
  const scoped = applyConditionFilters(basePopulation, filters);
  const scope = scopeLabel(filters);

  // --- Employee lookup by ID (e.g. "EMP00123") ---
  const idMatch = q.match(/\bemp\d+\b/i);
  if (idMatch) {
    const id = idMatch[0].toUpperCase();
    const matches = allRecords.filter((r) => r.EmployeeID === id);
    if (matches.length === 0) return { text: `I couldn't find an employee with ID ${id}.` };
    const record = (filters.month ? matches.find((r) => r.Month === filters.month) : undefined) ?? matches[matches.length - 1];
    return { text: employeeProfileText(record) };
  }

  // --- Employee lookup by name ("who is...", "tell me about...") ---
  const nameMatch = q.match(
    /(?:who is|tell me about|info(?:rmation)? on|profile (?:for|of)|details (?:on|about))\s+([a-z][a-z\s]{1,40}?)(?:\?|$)/
  );
  if (nameMatch) {
    const namePart = nameMatch[1].trim();
    if (namePart.length >= 3) {
      const matches = allRecords.filter((r) => r.Name.toLowerCase().includes(namePart));
      const uniqueIds = [...new Set(matches.map((r) => r.EmployeeID))];
      if (uniqueIds.length === 0) {
        return { text: `I couldn't find an employee named "${namePart}".` };
      }
      if (uniqueIds.length > 1) {
        const names = uniqueIds
          .slice(0, 8)
          .map((id) => matches.find((r) => r.EmployeeID === id)?.Name)
          .join(", ");
        return { text: `Multiple employees match "${namePart}": ${names}. Try including their Employee ID for an exact match.` };
      }
      const empMatches = matches.filter((r) => r.EmployeeID === uniqueIds[0]);
      const record = (filters.month ? empMatches.find((r) => r.Month === filters.month) : undefined) ?? empMatches[empMatches.length - 1];
      return { text: employeeProfileText(record) };
    }
  }

  // --- Dataset meta info ---
  if (/what departments|which departments|list departments/.test(q)) {
    return { text: `The dataset covers ${DEPARTMENTS.length} departments: ${DEPARTMENTS.join(", ")}.` };
  }
  if (/what grades|which grades|list grades/.test(q)) {
    return { text: `The dataset uses ${GRADES.length} grades: ${GRADES.join(", ")}.` };
  }
  if (/what months|which months|date range|how many months/.test(q)) {
    const monthsPresent = new Set(allRecords.map((r) => r.Month));
    const sorted = MONTH_ORDER.filter((m) => monthsPresent.has(m));
    return { text: `The dataset covers ${sorted.length} month${sorted.length === 1 ? "" : "s"}: ${sorted.join(", ")}.` };
  }
  if (/how many (total )?(records|rows)/.test(q)) {
    return { text: `There are ${formatNumber(allRecords.length)} total records in the dataset.` };
  }

  if (scoped.length === 0) {
    return { text: `I couldn't find any records${scope}. Try different departments, grades, months, or thresholds.` };
  }

  // --- List queries (plural results) ---
  if (LIST_TRIGGER.test(q)) {
    const { sorted, describe } = metricSort(q, scoped);
    const cap = 10;
    const shown = sorted.slice(0, cap);
    const lines = shown.map((r) => `• ${r.Name} (${r.Department}, ${r.Grade}) — ${describe(r)}`);
    const remainder = sorted.length - shown.length;
    return {
      text: `${formatNumber(sorted.length)} employee record${sorted.length === 1 ? "" : "s"}${scope}:\n${lines.join("\n")}${
        remainder > 0 ? `\n...and ${remainder} more.` : ""
      }`,
    };
  }

  // --- Department ranking ("which department has the highest/lowest X") ---
  if (/which department|what department/.test(q) && /(highest|most|lowest|least|top|bottom)/.test(q)) {
    const metric = departmentMetric(q);
    const monthScoped = filters.month ? allRecords.filter((r) => r.Month === filters.month) : allRecords;
    const ranking = DEPARTMENTS.map((d) => ({ department: d, value: metric.fn(monthScoped.filter((r) => r.Department === d)) })).sort(
      (a, b) => b.value - a.value
    );
    const wantsLowest = /(lowest|least|bottom)/.test(q);
    const result = wantsLowest ? ranking[ranking.length - 1] : ranking[0];
    return {
      text: `${result.department} has the ${wantsLowest ? "lowest" : "highest"} ${metric.label}${
        filters.month ? ` in ${filters.month}` : ""
      }: ${metric.format(result.value)}.`,
    };
  }

  // --- Direct department comparison ("compare Engineering and Sales") ---
  if (/compare|\bvs\.?\b|versus/.test(q)) {
    const mentioned = DEPARTMENTS.filter((d) => q.includes(d.toLowerCase()));
    if (mentioned.length === 2) {
      const metric = departmentMetric(q);
      const monthScoped = filters.month ? allRecords.filter((r) => r.Month === filters.month) : allRecords;
      const valA = metric.fn(monthScoped.filter((r) => r.Department === mentioned[0]));
      const valB = metric.fn(monthScoped.filter((r) => r.Department === mentioned[1]));
      return {
        text: `${metric.label}${filters.month ? ` (${filters.month})` : ""} — ${mentioned[0]}: ${metric.format(
          valA
        )}, ${mentioned[1]}: ${metric.format(valB)}.`,
      };
    }
  }

  // --- Percentage / ratio questions ---
  if (/percent(?:age)?\b|\bratio\b|\bshare of\b/.test(q)) {
    const pct = (scoped.length / basePopulation.length) * 100;
    const conditionLabel =
      filters.promotionEligible === true
        ? "are promotion eligible"
        : filters.promotionEligible === false
        ? "are not promotion eligible"
        : filters.minRisk !== undefined
        ? `have a risk score of ${filters.minRisk}+`
        : filters.maxRisk !== undefined
        ? `have a risk score under ${filters.maxRisk}`
        : "match that condition";
    const baseLabel =
      filters.department || filters.grade || filters.month
        ? ` of employees${scopeLabel(scopeOnly)}`
        : " of all employees";
    return { text: `${pct.toFixed(1)}%${baseLabel} ${conditionLabel}.` };
  }

  // --- Median ---
  if (/median/.test(q)) {
    if (/salary|pay|compensation/.test(q)) {
      return { text: `Median monthly salary${scope} is ${formatCurrency(median(scoped.map((r) => r.MonthlySalary)))}.` };
    }
    if (/overtime/.test(q)) {
      return { text: `Median overtime${scope} is ${median(scoped.map((r) => r.OvertimeHours)).toFixed(1)} hours.` };
    }
    if (/risk|attrition/.test(q)) {
      return { text: `Median attrition risk score${scope} is ${median(scoped.map((r) => r.AttritionRiskScore)).toFixed(1)}/100.` };
    }
    if (/rating|performance/.test(q)) {
      return { text: `Median performance rating${scope} is ${median(scoped.map((r) => r.PerformanceRating)).toFixed(2)}/5.0.` };
    }
  }

  // --- Promotion eligibility ---
  if (/promotion|eligible/.test(q)) {
    const eligible = scoped.filter((r) => r.PromotionEligible);
    const uniqueEligible = new Set(eligible.map((r) => r.EmployeeID)).size;
    const baseScope = scopeLabel({ ...filters, promotionEligible: undefined });
    return {
      text: `${formatNumber(uniqueEligible)} employee record${uniqueEligible === 1 ? "" : "s"}${baseScope} ${
        uniqueEligible === 1 ? "is" : "are"
      } promotion eligible (performance rating above 4.2).`,
    };
  }

  // --- Overtime ---
  if (/overtime/.test(q) && /(max|highest|most|top)/.test(q)) {
    const top = [...scoped].sort((a, b) => b.OvertimeHours - a.OvertimeHours)[0];
    return { text: `The maximum overtime${scope} is ${top.OvertimeHours} hours, logged by ${top.Name} (${top.Department}, ${top.Month}).` };
  }
  if (/overtime/.test(q) && /(min|lowest|least)/.test(q)) {
    const bottom = [...scoped].sort((a, b) => a.OvertimeHours - b.OvertimeHours)[0];
    return { text: `The minimum overtime${scope} is ${bottom.OvertimeHours} hours, logged by ${bottom.Name} (${bottom.Department}, ${bottom.Month}).` };
  }
  if (/overtime/.test(q) && /(average|avg|mean)/.test(q)) {
    return { text: `Average overtime${scope} is ${mean(scoped.map((r) => r.OvertimeHours)).toFixed(1)} hours.` };
  }
  if (/overtime/.test(q) && /(total|\bsum\b)/.test(q)) {
    const total = scoped.reduce((s, r) => s + r.OvertimeHours, 0);
    return { text: `Total overtime${scope} is ${formatNumber(total)} hours.` };
  }
  if (/overtime pay/.test(q)) {
    const total = scoped.reduce((s, r) => s + r.OvertimePay, 0);
    return { text: `Total overtime pay${scope} is ${formatCurrency(total)}.` };
  }

  // --- Attrition risk ---
  if (/attrition|risk/.test(q) && /(max|highest|most|top)/.test(q)) {
    const top = [...scoped].sort((a, b) => b.AttritionRiskScore - a.AttritionRiskScore)[0];
    return { text: `Highest attrition risk${scope}: ${top.Name} (${top.Department}, ${top.Month}) with a score of ${top.AttritionRiskScore}/100.` };
  }
  if (/attrition|risk/.test(q) && /(average|avg|mean)/.test(q)) {
    return { text: `Average attrition risk score${scope} is ${mean(scoped.map((r) => r.AttritionRiskScore)).toFixed(1)}/100.` };
  }

  // --- Performance rating ---
  if (/(top|best|highest) performer/.test(q) || (/performance/.test(q) && /(max|highest|top)/.test(q))) {
    const top = [...scoped].sort((a, b) => b.PerformanceRating - a.PerformanceRating)[0];
    return { text: `The top performer${scope} is ${top.Name} (${top.Department}) with a rating of ${top.PerformanceRating.toFixed(1)}/5.0.` };
  }
  if (/performance|rating/.test(q) && /(average|avg|mean)/.test(q)) {
    return { text: `Average performance rating${scope} is ${mean(scoped.map((r) => r.PerformanceRating)).toFixed(2)}/5.0.` };
  }

  // --- Salary ---
  if (/salary|pay|compensation/.test(q) && /(average|avg|mean)/.test(q)) {
    return { text: `Average monthly salary${scope} is ${formatCurrency(mean(scoped.map((r) => r.MonthlySalary)))}.` };
  }
  if (/salary|pay|payroll/.test(q) && /(total|\bsum\b)/.test(q)) {
    const total = scoped.reduce((s, r) => s + r.MonthlySalary, 0);
    return { text: `Total monthly payroll${scope} is ${formatCurrency(total)}.` };
  }
  if (/salary|pay/.test(q) && /(max|highest|top)/.test(q)) {
    const top = [...scoped].sort((a, b) => b.MonthlySalary - a.MonthlySalary)[0];
    return { text: `Highest paid employee${scope}: ${top.Name} (${top.Department}, ${top.Grade}) at ${formatCurrency(top.MonthlySalary)}/mo.` };
  }
  if (/salary|pay/.test(q) && /(min|lowest)/.test(q)) {
    const bottom = [...scoped].sort((a, b) => a.MonthlySalary - b.MonthlySalary)[0];
    return { text: `Lowest paid employee${scope}: ${bottom.Name} (${bottom.Department}, ${bottom.Grade}) at ${formatCurrency(bottom.MonthlySalary)}/mo.` };
  }

  // --- Headcount / generic count ---
  if (/how many employees|headcount|head count/.test(q)) {
    const count = new Set(scoped.map((r) => r.EmployeeID)).size;
    return { text: `There are ${formatNumber(count)} unique employees${scope}.` };
  }
  if (/how many|count|number of/.test(q)) {
    const count = new Set(scoped.map((r) => r.EmployeeID)).size;
    return { text: `${formatNumber(count)} employees match your query${scope}.` };
  }

  return {
    text:
      "I can answer questions about the whole dataset — try things like:\n" +
      '• "Tell me about EMP00042" or "Who is Jessica Adams?"\n' +
      '• "Which department has the highest overtime?"\n' +
      '• "Compare Engineering and Sales payroll"\n' +
      '• "What percentage of employees are promotion eligible?"\n' +
      '• "Median salary in Operations"\n' +
      '• "List employees in Sales with attrition risk above 80"\n' +
      '• "How many G3 employees in Engineering are promotion eligible?"\n' +
      "You can scope any question by department, grade, or month.",
  };
}
