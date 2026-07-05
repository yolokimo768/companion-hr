"""Generate a synthetic HR compensation dataset for CompanionHR.

Produces hr_dataset.csv with 25,000 rows: 6,250 unique employees tracked
across 4 months (Jan-Apr), simulating realistic payroll trends.
"""
import csv
import random

random.seed(42)

MONTHS = ["Jan", "Feb", "Mar", "Apr"]
DEPARTMENTS = ["Engineering", "Operations", "Finance", "Sales", "Customer Success", "HR"]
GRADES = ["G1", "G2", "G3", "G4", "G5"]

NUM_EMPLOYEES = 6250  # x4 months = 25,000 rows

# Salary bands scaled logically by grade ($3,000 - $18,000)
GRADE_SALARY_RANGE = {
    "G1": (3000, 5200),
    "G2": (5000, 7800),
    "G3": (7600, 10800),
    "G4": (10600, 14600),
    "G5": (14400, 18000),
}

# Department influences grade mix slightly (e.g. Eng/Finance skew senior)
DEPARTMENT_GRADE_WEIGHTS = {
    "Engineering":      [0.10, 0.20, 0.30, 0.25, 0.15],
    "Operations":       [0.25, 0.30, 0.25, 0.15, 0.05],
    "Finance":          [0.10, 0.20, 0.30, 0.25, 0.15],
    "Sales":            [0.15, 0.30, 0.30, 0.18, 0.07],
    "Customer Success": [0.20, 0.35, 0.25, 0.15, 0.05],
    "HR":               [0.20, 0.30, 0.30, 0.15, 0.05],
}

# Base overtime hour ranges per department (Operations/Engineering run hottest)
DEPARTMENT_OT_RANGE = {
    "Engineering": (5, 42),
    "Operations": (8, 48),
    "Finance": (0, 14),
    "Sales": (0, 18),
    "Customer Success": (0, 16),
    "HR": (0, 8),
}

# Monthly multiplier to simulate payroll trends (e.g. quarter-end OT spikes)
MONTH_OT_MULTIPLIER = {"Jan": 0.85, "Feb": 0.95, "Mar": 1.25, "Apr": 1.05}
MONTH_RAISE_FACTOR = {"Jan": 1.000, "Feb": 1.004, "Mar": 1.009, "Apr": 1.015}

FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Priya", "Wei", "Fatima", "Hiroshi", "Amara", "Liam", "Olivia", "Noah", "Emma",
    "Ava", "Sofia", "Mateo", "Yuki", "Chen", "Aisha", "Diego", "Ingrid", "Omar", "Nia",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Patel", "Kim", "Chowdhury", "Okafor", "Tanaka", "Kowalski",
]


def weighted_grade(dept: str) -> str:
    """Pick a random pay grade for a department, biased by DEPARTMENT_GRADE_WEIGHTS.

    Parameters:
        dept (str): the department name to pick a grade for; must be a key of
            both DEPARTMENTS and DEPARTMENT_GRADE_WEIGHTS.

    Returns:
        str: one grade from GRADES ("G1"-"G5"), chosen with the probability
            weights configured for `dept` (e.g. Engineering skews senior).
    """
    return random.choices(GRADES, weights=DEPARTMENT_GRADE_WEIGHTS[dept], k=1)[0]


def clamp(value, lo, hi):
    """Restrict a numeric value to a closed [lo, hi] range.

    Parameters:
        value (float): the number to clamp.
        lo (float): the minimum allowed value.
        hi (float): the maximum allowed value.

    Returns:
        float: `value` if it already falls within [lo, hi], otherwise
            whichever bound it exceeded.
    """
    return max(lo, min(hi, value))


def build_employee(idx: int):
    """Generate one synthetic employee's fixed (month-independent) attributes.

    Parameters:
        idx (int): a 1-based sequential index used to build this employee's
            EmployeeID (e.g. idx=1 -> "EMP00001").

    Returns:
        dict: the employee's identity and baseline traits used later to
            derive every month's row -
            EmployeeID (str), Name (str), Department (str), Grade (str),
            base_salary (float) - the employee's baseline monthly salary before month-specific raise factors are applied,
            base_performance (float) - the employee's baseline performance rating (1.0-5.0) before month-to-month drift is applied,
            attrition_bias (float) - a personal attrition tendency in [0, 1] (0 = low risk, 1 = high risk) used as an input to each month's risk score.
    """
    dept = random.choice(DEPARTMENTS)
    grade = weighted_grade(dept)
    lo, hi = GRADE_SALARY_RANGE[grade]
    base_salary = round(random.uniform(lo, hi), 2)
    base_performance = clamp(random.gauss(3.5, 0.65), 1.0, 5.0)
    base_attrition_bias = random.uniform(0, 1)  # personal tendency, 0=low risk, 1=high risk
    return {
        "EmployeeID": f"EMP{idx:05d}",
        "Name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
        "Department": dept,
        "Grade": grade,
        "base_salary": base_salary,
        "base_performance": base_performance,
        "attrition_bias": base_attrition_bias,
    }


def main():
    """Generate the full synthetic dataset and write it to hr_dataset.csv.

    Builds NUM_EMPLOYEES employees via `build_employee`, then for each
    employee generates one row per month in MONTHS: applies that month's
    raise factor to salary, derives overtime hours/pay from the employee's
    department range and that month's overtime multiplier, drifts the
    performance rating slightly from the employee's baseline, derives an
    attrition risk score from the employee's bias plus performance/overtime
    penalties and random noise, and flags promotion eligibility from the
    performance rating. All 25,000 resulting rows (NUM_EMPLOYEES x len(MONTHS))
    are written to hr_dataset.csv with a header row. Takes no parameters and
    returns nothing; its output is the CSV file written to disk (plus a
    summary line printed to stdout).
    """
    rows = []
    employees = [build_employee(i + 1) for i in range(NUM_EMPLOYEES)]

    for emp in employees:
        dept = emp["Department"]
        ot_lo, ot_hi = DEPARTMENT_OT_RANGE[dept]

        for month in MONTHS:
            monthly_salary = round(emp["base_salary"] * MONTH_RAISE_FACTOR[month], 2)
            hourly_rate = monthly_salary / 173.33  # ~40hrs/wk * 52wks / 12mo

            ot_multiplier = MONTH_OT_MULTIPLIER[month]
            overtime_hours = int(clamp(round(random.uniform(ot_lo, ot_hi) * ot_multiplier), 0, 80))
            overtime_pay = round(overtime_hours * hourly_rate * 1.5, 2)

            performance_drift = random.gauss(0, 0.15)
            performance_rating = round(clamp(emp["base_performance"] + performance_drift, 1.0, 5.0), 1)

            risk_base = emp["attrition_bias"] * 70
            risk_perf_penalty = max(0, (3.2 - performance_rating)) * 8
            risk_ot_penalty = min(overtime_hours, 50) * 0.3
            risk_noise = random.uniform(-8, 8)
            attrition_risk = int(clamp(round(risk_base + risk_perf_penalty + risk_ot_penalty + risk_noise + 5), 1, 100))

            promotion_eligible = performance_rating > 4.2

            rows.append({
                "EmployeeID": emp["EmployeeID"],
                "Name": emp["Name"],
                "Department": dept,
                "Grade": emp["Grade"],
                "MonthlySalary": f"{monthly_salary:.2f}",
                "OvertimeHours": overtime_hours,
                "OvertimePay": f"{overtime_pay:.2f}",
                "PerformanceRating": f"{performance_rating:.1f}",
                "AttritionRiskScore": attrition_risk,
                "PromotionEligible": str(promotion_eligible).upper(),
                "Month": month,
            })

    fieldnames = [
        "EmployeeID", "Name", "Department", "Grade", "MonthlySalary",
        "OvertimeHours", "OvertimePay", "PerformanceRating",
        "AttritionRiskScore", "PromotionEligible", "Month",
    ]

    with open("hr_dataset.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} rows for {NUM_EMPLOYEES} employees across {len(MONTHS)} months -> hr_dataset.csv")


if __name__ == "__main__":
    main()
