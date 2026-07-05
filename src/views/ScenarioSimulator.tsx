import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import { runScenario, type ScenarioInputs } from "../utils/simulate";
import { formatCurrency } from "../utils/format";
import { DEPARTMENTS } from "../types";

/** The scenario's starting values, restored whenever the "Reset" button is clicked. */
const DEFAULTS: ScenarioInputs = {
  department: "Engineering",
  departmentSalaryIncreasePct: 0,
  overtimeReductionPct: 0,
  additionalHires: 0,
  globalAnnualRaisePct: 0,
};

/**
 * Props for `Slider`.
 *
 * - label: string - the text shown above the slider.
 * - value: number - the slider's current value.
 * - min: number - the minimum selectable value.
 * - max: number - the maximum selectable value.
 * - step: number - the increment the slider moves by.
 * - suffix: string - a unit string appended after the displayed value (e.g. "%").
 * - onChange: (v: number) => void - callback fired with the new value whenever the slider moves.
 */
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}

/**
 * A labeled numeric range input with min/max captions and a live value
 * readout, used for every adjustable lever in the Scenario Controls panel.
 *
 * @param props - SliderProps - see `SliderProps` for each field's meaning.
 */
function Slider({ label, value, min, max, step, suffix, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-sm font-semibold text-indigo-400 tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

/**
 * The "what-if" compensation policy modeler: lets the user adjust a target
 * department's salary increase, a company-wide overtime reduction, a number
 * of hypothetical new hires, and a global annual raise, then shows the
 * resulting fiscal impact (computed via `runScenario`) compared to the
 * actual current budget. All computation happens client-side, live, as the
 * sliders move.
 */
export function ScenarioSimulator() {
  const { filteredRecords, selectedMonth } = useHRData();
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULTS);

  const result = useMemo(
    () => runScenario(filteredRecords, inputs),
    [filteredRecords, inputs]
  );

  /**
   * Type-safe setter for a single field of `inputs`, used by every
   * slider/select's onChange handler.
   *
   * @param key - K (a key of ScenarioInputs) - which field to update.
   * @param value - ScenarioInputs[K] - the new value for that field.
   */
  const set = <K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const impactPositive = result.netFiscalImpact >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Scenario Controls</h3>
          <button
            onClick={() => setInputs(DEFAULTS)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">
            Target Department
          </label>
          <select
            value={inputs.department}
            onChange={(e) => set("department", e.target.value as ScenarioInputs["department"])}
            className="w-full rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <Slider
          label={`${inputs.department} Salary Increase`}
          value={inputs.departmentSalaryIncreasePct}
          min={0}
          max={30}
          step={1}
          suffix="%"
          onChange={(v) => set("departmentSalaryIncreasePct", v)}
        />
        <Slider
          label="Overtime Reduction"
          value={inputs.overtimeReductionPct}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={(v) => set("overtimeReductionPct", v)}
        />
        <Slider
          label={`Additional ${inputs.department} Hires`}
          value={inputs.additionalHires}
          min={0}
          max={100}
          step={1}
          suffix=""
          onChange={(v) => set("additionalHires", v)}
        />
        <Slider
          label="Global Annual Raise"
          value={inputs.globalAnnualRaisePct}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onChange={(v) => set("globalAnnualRaisePct", v)}
        />

        <p className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          Modeling against the {selectedMonth === "All" ? "full" : selectedMonth} snapshot
          &middot; {filteredRecords.length.toLocaleString()} records.
        </p>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-medium text-slate-500">Original Budget</p>
            <p className="mt-1.5 text-2xl font-semibold text-slate-100 tabular-nums">
              {formatCurrency(result.originalBudget)}
            </p>
            <p className="mt-1 text-xs text-slate-600">Monthly payroll + overtime</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-medium text-slate-500">Simulated Budget</p>
            <p className="mt-1.5 text-2xl font-semibold text-slate-100 tabular-nums">
              {formatCurrency(result.simulatedBudget)}
            </p>
            <p className="mt-1 text-xs text-slate-600">After applied scenario</p>
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 ${
            impactPositive
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {impactPositive ? (
              <TrendingUp size={18} className="text-rose-400" />
            ) : (
              <TrendingDown size={18} className="text-emerald-400" />
            )}
            <p className="text-xs font-medium text-slate-400">Net Fiscal Impact (Monthly)</p>
          </div>
          <p
            className={`mt-1.5 text-3xl font-bold tabular-nums ${
              impactPositive ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {impactPositive ? "+" : ""}
            {formatCurrency(result.netFiscalImpact)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Annualized: {impactPositive ? "+" : ""}
            {formatCurrency(result.netFiscalImpactAnnualized)} / year
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">Budget Breakdown</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Base Salaries (simulated)</dt>
              <dd className="text-slate-200 tabular-nums">{formatCurrency(result.simulatedSalaryTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Overtime Pay (simulated)</dt>
              <dd className="text-slate-200 tabular-nums">{formatCurrency(result.simulatedOvertimeTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">New Hires Cost</dt>
              <dd className="text-slate-200 tabular-nums">{formatCurrency(result.newHiresCost)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
