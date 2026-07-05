import { Upload, RotateCcw } from "lucide-react";
import { useRef } from "react";
import { useHRData } from "../hooks/useHRData";

/**
 * Header control for loading data: a hidden file input plus an "Upload CSV"
 * button that opens it, a "Reload default dataset" button, and a small
 * readout of the currently-loaded file name and row count. All parsing is
 * delegated to `useHRData`'s `loadFile`/`reloadDefault` — this component only
 * handles the file-picker UI.
 */
export function UploadCSV() {
  const { loadFile, reloadDefault, fileName, records, loading } = useHRData();
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles the native file input's change event: reads the selected file (if
   * any) and hands it to `loadFile`, then resets the input's value so
   * selecting the same file again still fires a change event.
   *
   * @param e - React.ChangeEvent<HTMLInputElement> - the file input change event.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors disabled:opacity-50"
      >
        <Upload size={14} />
        <span className="hidden sm:inline">Upload CSV</span>
      </button>
      <button
        onClick={reloadDefault}
        disabled={loading}
        title="Reload default dataset"
        className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:opacity-50"
      >
        <RotateCcw size={14} />
      </button>
      <div className="hidden sm:flex flex-col leading-tight text-xs text-slate-500">
        <span className="text-slate-300 truncate max-w-[180px]">{fileName}</span>
        <span>{records.length.toLocaleString()} rows loaded</span>
      </div>
    </div>
  );
}
