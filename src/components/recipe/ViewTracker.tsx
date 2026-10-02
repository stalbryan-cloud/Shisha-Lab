'use client';
import { useEffect } from 'react';
import { recordView } from '@/lib/actions/social';

/** Counts one view per visitor per 30 min (server action sets the cookie; Server Components cannot). */
export function ViewTracker({ recipeId }: { recipeId: string }) {
  useEffect(() => { void recordView(recipeId); }, [recipeId]);
  return null;
}
