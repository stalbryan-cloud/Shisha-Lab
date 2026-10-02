import type { Metadata } from 'next';
import Link from 'next/link';
import { exploreFacets, type Facet } from '@/lib/queries/recipes';
import { SearchAutocomplete } from '@/components/layout/SearchAutocomplete';

export const metadata: Metadata = { title: 'Explore', description: 'Explore recipes by flavour, flavour profile, aroma brand, leaf type and origin.' };
export const revalidate = 300;

function Cloud({ title, items, href, id }: { title: string; items: Facet[]; href: (f: Facet) => string; id: string }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="card p-5">
      <h2 id={id} className="font-display text-xl">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((f) => <li key={`${f.slug ?? f.name}`}><Link href={href(f)} className="chip hover:border-amber/60 hover:text-amber">{f.name}<span className="text-mute">{f.count}</span></Link></li>)}
      </ul>
    </section>
  );
}

export default async function ExplorePage() {
  const f = await exploreFacets();
  return (
    <div className="container space-y-6 py-8">
      <div><h1 className="font-display text-3xl">Explore</h1><p className="text-mute">Start from a flavour, a profile, or a brand and see what the community has made.</p></div>
      <div className="max-w-xl"><SearchAutocomplete size="lg" /></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Cloud id="x-prof" title="Flavour profiles" items={f.profiles} href={(x) => `/recipes?profile=${x.slug}`} />
        <Cloud id="x-flav" title="Flavours" items={f.flavours} href={(x) => `/recipes?flavour=${x.slug}`} />
        <Cloud id="x-abr" title="Aroma brands" items={f.aroma_brands} href={(x) => `/recipes?aromaBrand=${x.slug}`} />
        <Cloud id="x-leaf" title="Leaf types" items={f.leaf_types} href={(x) => `/recipes?leaf=${x.slug}`} />
        <Cloud id="x-origin" title="Tobacco origin" items={f.origins} href={(x) => `/recipes?origin=${encodeURIComponent(x.name)}`} />
      </div>
      <p className="text-xs text-mute">Brand and ingredient names shown here are information about what recipes use. We never link to places that sell them.</p>
    </div>
  );
}
