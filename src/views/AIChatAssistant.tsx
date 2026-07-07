import { useRef, useState, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, KeyRound, X, Loader2 } from "lucide-react";
import { useHRData } from "../hooks/useHRData";
import { answerQuery } from "../utils/chatEngine";
import { buildDataDigest, findEmployeeRecords } from "../utils/dataDigest";
import { renderMarkdown } from "../utils/markdown";
import {
  askClaude,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  type ClaudeChatMessage,
} from "../utils/claudeClient";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Why did payroll increase in March?",
  "Which department has the highest overtime?",
  "Compare Engineering and Sales payroll",
  "Who is the best performer that should get a promotion in Finance?",
  "List employees in Sales with attrition risk above 80",
  "Which employees have attendance issues?",
  "Compare compensation between our offices",
];

const SYSTEM_PROMPT_INTRO = `You are the AI HR Assistant inside CompanionHR, an HR compensation analytics tool. Answer questions about the company's workforce using the data digest below plus the query_employees tool as your sources of truth — never invent numbers. The digest contains aggregated stats (per department, per month, per grade, and per office/location for the latest month) plus a few notable individual records, which is enough for most "overall" or "compare X and Y" questions, including comparing compensation/overtime/attendance across offices via the byLocation section. For anything that needs actual employee-level rows — cross-tabulating two or more fields (e.g. "high performance but low compensation", "high overtime and high attrition risk"), attendance/absence questions (the AbsenceDays field), filtering by a specific office, listing or counting specific people, looking someone up by name/ID, or any precise per-employee question — call the query_employees tool instead of guessing. You can combine several filters in one call (e.g. minPerformanceRating + maxSalary, or location + minAbsenceDays) and can call it more than once if you need to compare groups. When judging "low compensation" or "high performance" etc., use sensible thresholds relative to the grade/department averages already in the digest (e.g. salary meaningfully below that grade's avgSalary, rating at or above 4.0) unless the user specifies exact numbers; for "attendance issues," 5+ absence days in a month is a reasonable default threshold unless the user specifies otherwise. Be concise, reference concrete numbers and real employee names when you have them, and speak like a helpful financial/HR analyst. When asked "why" something changed, reason from the month-over-month deltas visible in the digest (e.g. compare department payroll/overtime/headcount across the months present).`;

function buildSystemPrompt(digest: string, employeeContext: string): string {
  return `${SYSTEM_PROMPT_INTRO}\n\nDATA DIGEST (JSON):\n${digest}${
    employeeContext ? `\n\nRELEVANT EMPLOYEE RECORDS (JSON):\n${employeeContext}` : ""
  }`;
}

function ApiKeySetup({ onSave, onSkip }: { onSave: (key: string) => void; onSkip: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
            <KeyRound size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Connect Claude</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          To get full conversational answers (open-ended questions, "why did X change", typo-tolerant
          understanding), paste an Anthropic API key. It's stored only in your browser's local storage and sent
          directly from your browser to Anthropic — never through any server of ours. You can get a key at{" "}
          <span className="text-slate-300">console.anthropic.com</span>.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSave(value.trim());
          }}
          className="space-y-2"
        >
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
          >
            Save & Connect
          </button>
        </form>
        <button
          onClick={onSkip}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300"
        >
          Skip — use local query engine instead (no API key, offline, pattern-matched answers only)
        </button>
      </div>
    </div>
  );
}

export function AIChatAssistant() {
  const { records } = useHRData();
  const [apiKey, setApiKey] = useState<string | null>(() => getStoredApiKey());
  const [useLocalOnly, setUseLocalOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! Ask me anything about the workforce — compensation, overtime, attrition, performance, promotions, or open-ended questions like \"why did payroll increase in March?\". I answer using the real dataset as my source of truth.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const digest = useMemo(() => buildDataDigest(records), [records]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    if (apiKey && !useLocalOnly) {
      setLoading(true);
      try {
        const employeeRecords = findEmployeeRecords(records, trimmed);
        const employeeContext = employeeRecords.length > 0 ? JSON.stringify(employeeRecords.slice(0, 8)) : "";
        const systemPrompt = buildSystemPrompt(digest, employeeContext);
        const history: ClaudeChatMessage[] = [...messages, userMsg]
          .filter((m) => m.id !== "welcome")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.text }));
        const reply = await askClaude(apiKey, systemPrompt, history, records);
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: message }]);
      } finally {
        setLoading(false);
      }
    } else {
      const answer = answerQuery(trimmed, records);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: answer.text }]);
    }
  };

  const handleSaveKey = (key: string) => {
    setStoredApiKey(key);
    setApiKey(key);
    setUseLocalOnly(false);
  };

  const handleRemoveKey = () => {
    clearStoredApiKey();
    setApiKey(null);
  };

  const showSetup = !apiKey && !useLocalOnly && messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[820px] rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">HR Assistant</p>
            <p className="text-[11px] text-slate-500">
              {apiKey && !useLocalOnly
                ? "Powered by Claude · grounded in your data"
                : `Local query engine · ${records.length.toLocaleString()} records indexed`}
            </p>
          </div>
        </div>
        {apiKey ? (
          <button
            onClick={handleRemoveKey}
            title="Remove API key"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400"
          >
            <X size={12} /> Disconnect
          </button>
        ) : (
          !useLocalOnly && null
        )}
      </div>

      {showSetup ? (
        <ApiKeySetup onSave={handleSaveKey} onSkip={() => setUseLocalOnly(true)} />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="shrink-0 rounded-full bg-indigo-500/15 p-1.5 text-indigo-400 h-fit">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "whitespace-pre-line bg-indigo-500 text-white rounded-tr-sm"
                      : "bg-slate-800 text-slate-200 rounded-tl-sm"
                  }`}
                >
                  {m.role === "assistant" ? renderMarkdown(m.text) : m.text}
                </div>
                {m.role === "user" && (
                  <div className="shrink-0 rounded-full bg-slate-700 p-1.5 text-slate-300 h-fit">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="shrink-0 rounded-full bg-indigo-500/15 p-1.5 text-indigo-400 h-fit">
                  <Bot size={14} />
                </div>
                <div className="rounded-xl rounded-tl-sm bg-slate-800 px-3.5 py-2.5 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-slate-800 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about salary, overtime, attrition, performance&hellip;"
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-lg bg-indigo-500 p-2.5 text-white hover:bg-indigo-400 disabled:opacity-40"
              disabled={!input.trim() || loading}
            >
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
