import type { ReactNode } from "react";

const INLINE_PATTERN = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`)/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(INLINE_PATTERN);
    if (!match || match.index === undefined) {
      nodes.push(remaining);
      break;
    }
    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }
    const k = `${keyPrefix}-${key++}`;
    if (match[2] !== undefined) {
      nodes.push(
        <strong key={k} className="font-semibold text-slate-100">
          <em>{match[2]}</em>
        </strong>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={k} className="font-semibold text-slate-100">
          {match[3]}
        </strong>
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <strong key={k} className="font-semibold text-slate-100">
          {match[4]}
        </strong>
      );
    } else if (match[5] !== undefined) {
      nodes.push(<em key={k}>{match[5]}</em>);
    } else if (match[6] !== undefined) {
      nodes.push(<em key={k}>{match[6]}</em>);
    } else if (match[7] !== undefined) {
      nodes.push(
        <code key={k} className="rounded bg-slate-950/60 px-1 py-0.5 text-[13px]">
          {match[7]}
        </code>
      );
    }
    remaining = remaining.slice(match.index + match[0].length);
  }

  return nodes;
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
const isBullet = (line: string) => /^\s*[-*]\s+/.test(line);
const isNumbered = (line: string) => /^\s*\d+\.\s+/.test(line);
const isHeader = (line: string) => /^#{1,6}\s+/.test(line);
const isSpecial = (line: string) => isHeader(line) || isTableRow(line) || isBullet(line) || isNumbered(line);

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (isHeader(line)) {
      const match = line.match(/^(#{1,6})\s+(.*)$/)!;
      const level = match[1].length;
      const bk = `b-${blockKey++}`;
      blocks.push(
        <p key={bk} className={`mb-0.5 mt-1 first:mt-0 ${level <= 2 ? "text-[15px]" : "text-sm"} font-semibold text-slate-100`}>
          {renderInline(match[2], bk)}
        </p>
      );
      i++;
      continue;
    }

    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter((l) => !isTableSeparator(l))
        .map((l) =>
          l
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim())
        );
      if (rows.length > 0) {
        const [header, ...body] = rows;
        const bk = `b-${blockKey++}`;
        blocks.push(
          <div key={bk} className="my-1.5 overflow-x-auto rounded-lg border border-slate-700/60">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/60">
                  {header.map((cell, ci) => (
                    <th key={ci} className="px-2.5 py-1.5 text-left font-semibold text-slate-300">
                      {renderInline(cell, `${bk}-th-${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="border-t border-slate-800/60">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2.5 py-1.5 align-top text-slate-300">
                        {renderInline(cell, `${bk}-td-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (isBullet(line) || isNumbered(line)) {
      const ordered = isNumbered(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? isNumbered(lines[i]) : isBullet(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        i++;
      }
      const bk = `b-${blockKey++}`;
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={bk} className={`my-1 space-y-0.5 pl-4 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `${bk}-li-${ii}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecial(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    const bk = `b-${blockKey++}`;
    blocks.push(
      <p key={bk} className="leading-relaxed">
        {paraLines.map((l, li) => (
          <span key={li}>
            {renderInline(l, `${bk}-${li}`)}
            {li < paraLines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  }

  return <>{blocks}</>;
}
