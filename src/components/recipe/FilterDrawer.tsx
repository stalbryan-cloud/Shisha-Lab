'use client';
import { useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

/** Mobile bottom sheet built on <dialog> (focus trap, Esc to close, backdrop). Desktop uses the sidebar instead. */
export function FilterDrawer({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="lg:hidden">
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}><SlidersHorizontal size={16} aria-hidden /> Filters{count > 0 && <span className="chip chip-amber py-0">{count}</span>}</button>
      <dialog ref={ref} aria-label="Filters" className="m-0 mt-auto h-[88dvh] w-full max-w-none animate-sheet-up overflow-hidden rounded-t-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-display text-lg">Filters</h2><button className="btn btn-ghost px-2" aria-label="Close filters" onClick={() => ref.current?.close()}><X size={20} /></button></div>
          <div className="flex-1 overflow-auto px-4 pb-4">{children}</div>
        </div>
      </dialog>
    </div>
  );
}
