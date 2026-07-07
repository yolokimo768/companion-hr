import { Menu } from "lucide-react";
import { UploadCSV } from "./UploadCSV";
import { MonthSelect } from "./MonthSelect";
import { LocationSelect } from "./LocationSelect";

/**
 * Props for `Header`.
 *
 * - title: string - the current view's title, shown as the page heading (e.g. "Payroll Dashboard").
 * - subtitle: string - a short description of the current view, shown under the title on larger screens.
 * - onOpenMobile: () => void - callback fired when the hamburger menu button is tapped, to open the mobile sidebar.
 */
interface HeaderProps {
  title: string;
  subtitle: string;
  onOpenMobile: () => void;
}

/**
 * The top bar shown above every view: a mobile menu toggle, the current
 * page's title/subtitle, and the shared month/location selectors + CSV
 * upload controls (which apply globally regardless of which view is active).
 *
 * @param props - HeaderProps - see `HeaderProps` for each field's meaning.
 */
export function Header({ title, subtitle, onOpenMobile }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 backdrop-blur">
      <button
        className="lg:hidden text-slate-400 hover:text-slate-200"
        onClick={onOpenMobile}
      >
        <Menu size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-semibold text-slate-50 truncate">{title}</h1>
        <p className="hidden sm:block text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <MonthSelect />
        <LocationSelect />
        <UploadCSV />
      </div>
    </header>
  );
}
