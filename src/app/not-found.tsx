import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="font-display text-6xl text-amber" aria-hidden>404</p>
      <h1 className="font-display text-2xl">We couldn’t find that page</h1>
      <p className="max-w-md text-mute">It may have been removed, made private, or the link might be wrong.</p>
      <div className="flex gap-2"><Link href="/" className="btn btn-primary">Go home</Link><Link href="/recipes" className="btn">Browse recipes</Link></div>
    </div>
  );
}
