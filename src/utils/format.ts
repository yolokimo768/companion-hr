/**
 * Formats a number as a US dollar amount for display.
 *
 * @param value - number - the raw dollar amount to format (e.g. 55700000).
 * @param opts - { compact?: boolean } (optional) - when `compact` is true, uses abbreviated notation (e.g. "$55.7M") instead of the full amount (e.g. "$55,700,000").
 * @returns string - the formatted currency string, with no decimal places in the non-compact form and up to 1 decimal place in the compact form.
 */
export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a number with US thousands separators for display (e.g. 25000 -> "25,000").
 *
 * @param value - number - the raw number to format.
 * @returns string - the formatted number string.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Formats a number as a percentage string for display (e.g. 12.34 -> "12.3%").
 *
 * @param value - number - the percentage value, already scaled to 0-100 (not a 0-1 fraction).
 * @param digits - number (optional, default 1) - how many decimal places to show.
 * @returns string - the value fixed to `digits` decimal places with a trailing "%".
 */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
