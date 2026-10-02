'use client';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';

export interface WithKey { _k: string }

function Row({ id, index, count, onMove, onRemove, label, children }: { id: string; index: number; count: number; onMove: (from: number, to: number) => void; onRemove: () => void; label: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`card p-3 ${isDragging ? 'z-10 opacity-80 ring-1 ring-amber' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-mute hover:bg-raised hover:text-ink active:cursor-grabbing" aria-label={`Drag to reorder ${label}. Press space, then arrow keys.`}><GripVertical size={18} /></button>
          <button type="button" className="rounded p-1 text-mute hover:bg-raised disabled:opacity-30" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${label} up`}><ArrowUp size={14} /></button>
          <button type="button" className="rounded p-1 text-mute hover:bg-raised disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${label} down`}><ArrowDown size={14} /></button>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        <button type="button" className="rounded p-2 text-mute hover:bg-danger/10 hover:text-danger" onClick={onRemove} aria-label={`Remove ${label}`}><Trash2 size={16} /></button>
      </div>
    </li>
  );
}

/** Drag-and-drop (pointer + keyboard) reorderable list with explicit up/down buttons as an accessible fallback. */
export function SortableList<T extends WithKey>({ items, onChange, renderItem, itemLabel }: { items: T[]; onChange: (items: T[]) => void; renderItem: (item: T, index: number) => React.ReactNode; itemLabel: (item: T, index: number) => string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from: number, to: number) => onChange(arrayMove(items, from, to));
  function end(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    move(items.findIndex((i) => i._k === e.active.id), items.findIndex((i) => i._k === e.over!.id));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((i) => i._k)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {items.map((it, i) => (
            <Row key={it._k} id={it._k} index={i} count={items.length} onMove={move} label={itemLabel(it, i)} onRemove={() => onChange(items.filter((x) => x._k !== it._k))}>{renderItem(it, i)}</Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
