'use client';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

export function SubmitButton({ children, pendingText = 'Saving…', className }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={cn('btn btn-primary', className)} disabled={pending} aria-busy={pending}>{pending ? pendingText : children}</button>;
}
