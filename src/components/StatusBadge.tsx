/**
 * Props for `StatusBadge`.
 *
 * - label: string - the text shown inside the badge (e.g. "High Risk", "Promotion Eligible").
 * - tone: "success" | "warning" | "danger" | "neutral" | "info" - which color scheme the badge uses, chosen to match the semantic meaning of `label`.
 */
interface StatusBadgeProps {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral" | "info";
}

/** Tailwind class strings for each supported tone. */
const TONES: Record<StatusBadgeProps["tone"], string> = {
  success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  danger: "bg-rose-500/10 text-rose-400 ring-rose-500/30",
  neutral: "bg-slate-500/10 text-slate-400 ring-slate-500/30",
  info: "bg-sky-500/10 text-sky-400 ring-sky-500/30",
};

/**
 * A small colored pill used to flag an employee's status at a glance (e.g.
 * "Promotion Eligible", "High Attrition Risk") in tables across the Employee
 * Search and Payroll Dashboard views.
 *
 * @param props - StatusBadgeProps - see `StatusBadgeProps` for each field's meaning.
 */
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
