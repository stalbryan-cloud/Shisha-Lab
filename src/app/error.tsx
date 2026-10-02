'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center" role="alert">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="max-w-md text-mute">That’s on us. Try again — if it keeps happening, check back in a few minutes.{error.digest && <span className="block text-xs">Reference: {error.digest}</span>}</p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
