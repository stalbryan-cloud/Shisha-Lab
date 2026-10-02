'use client';
import { Star } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/** Accessible 1–5 star radio group. Posts through a hidden-by-semantics radio set so it works inside plain <form>s. */
export function RatingInput({ name, defaultValue = 0, label, required }: { name: string; defaultValue?: number; label: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const id = useId();
  return (
    <fieldset>
      <legend className="label">{label}{required && <span className="text-danger"> *</span>}</legend>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-1" onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => setValue(n)} className="peer sr-only" id={`${id}-${n}`} required={required && n === 1} />
            <Star size={26} className={cn('transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber', n <= (hover || value) ? 'fill-amber text-amber' : 'text-line')} />
            <span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
