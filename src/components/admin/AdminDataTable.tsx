import type { ReactNode } from 'react';

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }

/** Plain accessible data table used by every admin list. Server-rendered; row actions are client components passed through `render`. */
export function AdminDataTable<T>({ columns, rows, rowKey, empty = 'Nothing to show.', caption }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: string; caption: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-mute">{columns.map((c) => <th key={c.key} scope="col" className={`px-3 py-2 font-medium ${c.className ?? ''}`}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-mute">{empty}</td></tr>}
          {rows.map((r) => <tr key={rowKey(r)} className="border-b border-line/50 align-top">{columns.map((c) => <td key={c.key} className={`px-3 py-2 ${c.className ?? ''}`}>{c.render(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
