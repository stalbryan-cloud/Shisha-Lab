import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Clock, History } from 'lucide-react';
import { getViewer, isStaff } from '@/lib/auth';
import {
  getRecipeBySlug, getViewerState, getReviews, getExperiments, getComments, getMakerIds, getVotedCommentIds, getModeratorIds, makerRating,
} from '@/lib/queries/recipe-detail';
import { similarRecipes } from '@/lib/queries/recipes';
import { publicEnv } from '@/lib/env';
import { publicImageUrl } from '@/lib/storage';
import { renderMarkdown, stripMarkdown } from '@/lib/core/markdown';
import { computeBadges, BADGE_LABELS } from '@/lib/core/badges';
import { hasEnoughRatings, summariseExperiments, commonModifications, MIN_EXPERIMENTS_FOR_STATS } from '@/lib/core/ratings';
import { toGrams, formatAmount, type WeightUnit, type BaseIngredientInput, type AromaInput } from '@/lib/core/scaler';
import { formatDate, formatHours, formatVersion, timeAgo } from '@/lib/utils';
import { RatingStars } from '@/components/ui/RatingStars';
import { UserBadge } from '@/components/ui/UserBadge';
import { ReportDialog } from '@/components/ui/ReportDialog';
import { RecipeScaler } from '@/components/recipe/RecipeScaler';
import { RatingDistribution } from '@/components/recipe/RatingDistribution';
import { SourceList } from '@/components/recipe/SourceList';
import { LikeButton, SaveButton } from '@/components/recipe/ToggleButtons';
import { ShareButton, PrintButton } from '@/components/recipe/ShareButton';
import { ReviewForm } from '@/components/recipe/ReviewForm';
import { ExperimentForm } from '@/components/recipe/ExperimentForm';
import { CommentThread, type ThreadCtx } from '@/components/recipe/CommentThread';
import { RecipeGrid } from '@/components/recipe/RecipeGrid';
import { ViewTracker } from '@/components/recipe/ViewTracker';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getRecipeBySlug(slug);
  if (!d) return { title: 'Recipe not found' };
  const r = d.recipe;
  const desc = (r.short_description ?? stripMarkdown(r.long_description ?? '')).slice(0, 180) || 'A community shisha tobacco recipe on SHISHA LAB.';
  const img = publicImageUrl(r.cover_image_path);
  const indexable = r.status === 'published' && r.visibility === 'public' && r.moderation === 'visible';
  return {
    title: r.title, description: desc,
    alternates: { canonical: `/recipes/${r.slug}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { title: r.title, description: desc, type: 'article', url: `${publicEnv.siteUrl}/recipes/${r.slug}`, images: img ? [{ url: img }] : undefined },
    twitter: { card: img ? 'summary_large_image' : 'summary', title: r.title, description: desc },
  };
}

const KIND_LABEL: Record<string, string> = { ingredient: 'Ingredient', quantity: 'Quantity', aroma: 'Aroma', resting_time: 'Resting time', process: 'Process', other: 'Other' };
const MAKER_LABEL = { made_exactly: 'Made as written', made_modified: 'Made with changes', not_made: 'Has not made it' } as const;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border border-line bg-surface px-3 py-2"><dt className="text-[11px] uppercase tracking-wider text-mute">{label}</dt><dd className="mt-0.5 text-sm font-medium">{value}</dd></div>;
}
const dots = (n: number | null) => (n == null ? '—' : <span aria-label={`${n} out of 5`}>{'●'.repeat(n)}<span className="text-line">{'●'.repeat(5 - n)}</span></span>);

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const detail = await getRecipeBySlug(slug);
  if (!detail) notFound();
  const { recipe: r, creator, base, aromas, steps, sources, versions, profiles, tags } = detail;
  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const staff = isStaff(viewer?.role);
  const isOwner = !!viewerId && viewerId === r.creator_id;

  const [state, reviews, experiments, comments, makerIds, votedIds, similar] = await Promise.all([
    getViewerState(r.id, viewerId), getReviews(r.id), getExperiments(r.id), getComments(r.id), getMakerIds(r.id),
    getVotedCommentIds(r.id, viewerId), r.status === 'published' ? similarRecipes(r.id, 6) : Promise.resolve([]),
  ]);
  const moderatorIds = await getModeratorIds([...new Set(comments.map((c) => c.user_id).filter((x): x is string => !!x))]);

  const unit = (r.units ?? 'g') as WeightUnit;
  const tobaccoG = r.tobacco_weight ? toGrams(Number(r.tobacco_weight), unit) : null;
  const batchG = r.target_batch_weight ? toGrams(Number(r.target_batch_weight), unit) : null;
  const baseInput: BaseIngredientInput[] = base.map((b) => ({ id: b.id, category: b.category as BaseIngredientInput['category'], name: b.name, brand: b.brand, weight_g: b.weight_g, volume_ml: b.volume_ml, density_g_per_ml: b.density_g_per_ml, notes: b.notes }));
  const aromaInput: AromaInput[] = aromas.map((a) => ({ id: a.id, flavour_name: a.flavour_name, brand: a.brand, concentrate_name: a.concentrate_name, weight_g: a.weight_g, volume_ml: a.volume_ml, pct_of_batch: a.pct_of_batch, manufacturer_recommended_pct: a.manufacturer_recommended_pct, role: a.role }));
  const tobaccoName = [r.tobacco_brand, r.tobacco_product_name].filter(Boolean).join(' ') || [r.tobacco_leaf_type, r.tobacco_leaf_family && `${r.tobacco_leaf_family} leaf`].filter(Boolean).join(' ') || 'Dry tobacco';

  const avg = r.review_count ? r.rating_sum / r.review_count : null;
  const maker = makerRating(r);
  const expStats = summariseExperiments(experiments);
  const mods = commonModifications(experiments.flatMap((e) => e.changes ?? []));
  const badges = computeBadges({ made_count: r.made_count, completeness: r.completeness, review_count: r.review_count, bayes_rating: r.bayes_rating, like_count: r.like_count, save_count: r.save_count, is_featured: r.is_featured, version_major: r.version_major, version_minor: r.version_minor, updated_at: r.updated_at });
  const cover = publicImageUrl(r.cover_image_path);

  const ctx: ThreadCtx = {
    recipeId: r.id, slug: r.slug, creatorId: r.creator_id, viewerId, viewerIsStaff: staff,
    makerIds: [...makerIds], moderatorIds: [...moderatorIds], votedIds: [...votedIds], maxDepth: 3,
    html: Object.fromEntries(comments.map((c) => [c.id, renderMarkdown(c.body, { maxLength: 5000 })])),
  };
  const loginHref = `/login?next=/recipes/${r.slug}`;

  // Deliberately CreativeWork, not schema.org/Recipe: Google's Recipe rich results are for food and would mislabel this content.
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: r.title, description: r.short_description ?? undefined,
    url: `${publicEnv.siteUrl}/recipes/${r.slug}`, dateModified: r.updated_at, datePublished: r.published_at ?? undefined, image: cover ?? undefined,
    author: creator ? { '@type': 'Person', name: creator.display_name || creator.username } : undefined,
    ...(hasEnoughRatings(r.review_count) && avg ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(avg.toFixed(2)), reviewCount: r.review_count, bestRating: 5, worstRating: 1 } } : {}),
  };

  return (
    <article className="container py-6 sm:py-10">
      <ViewTracker recipeId={r.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {r.status !== 'published' && <p className="mb-4 rounded-md border border-amber/40 bg-amber/10 px-4 py-2 text-sm text-amber" role="status">This recipe is {r.status}{isOwner ? ' and only visible to you.' : '.'}</p>}
      {r.moderation !== 'visible' && staff && <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger" role="status">Moderation state: {r.moderation}. Visible to staff only.</p>}
      {r.visibility !== 'public' && r.status === 'published' && <p className="mb-4 rounded-md border border-line bg-surface px-4 py-2 text-sm text-mute" role="status">{r.visibility === 'unlisted' ? 'Unlisted — only people with the link can see this.' : 'Private — only you can see this.'}</p>}

      <header className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
            <span className="chip">{formatVersion(r.version_major, r.version_minor)}</span>
            {r.is_demo && <span className="chip">Demo data</span>}
            {badges.map((b) => <span key={b} className="chip chip-amber" title={BADGE_LABELS[b].description}>{BADGE_LABELS[b].label}</span>)}
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{r.title}</h1>
          {r.short_description && <p className="mt-2 text-lg text-ink/80">{r.short_description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <UserBadge profile={creator} />
            <span className="text-mute">Updated {timeAgo(r.updated_at)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profiles.map((p) => <Link key={p.slug} href={`/recipes?profile=${p.slug}`} className="chip hover:border-amber/50">{p.name}</Link>)}
            {tags.map((t) => <Link key={t.slug} href={`/recipes?tag=${t.slug}`} className="chip hover:border-amber/50">#{t.name}</Link>)}
          </div>
          <div className="no-print mt-5 flex flex-wrap items-start gap-2">
            <SaveButton recipeId={r.id} slug={r.slug} saved={state.saved} count={r.save_count} signedIn={!!viewer} />
            <LikeButton recipeId={r.id} slug={r.slug} liked={state.liked} count={r.like_count} signedIn={!!viewer} />
            {r.status === 'published' && !isOwner && <a href="#results" className="btn btn-primary">I made this</a>}
            <ShareButton title={r.title} />
            <PrintButton />
            {!isOwner && <ReportDialog targetType="recipe" targetId={r.id} signedIn={!!viewer} />}
            {isOwner && <Link href={`/recipes/${r.slug}/edit`} className="btn"><Pencil size={16} aria-hidden /> Edit</Link>}
          </div>
        </div>
        {cover && <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line"><Image src={cover} alt={`Cover image for ${r.title}`} fill priority sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" /></div>}
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Community rating" value={hasEnoughRatings(r.review_count) ? <RatingStars value={avg} count={r.review_count} /> : <span className="text-mute">Not enough ratings yet ({r.review_count}/3)</span>} />
        <Stat label="Verified maker rating" value={maker.count >= 1 ? <RatingStars value={maker.avg} count={maker.count} /> : <span className="text-mute">None yet</span>} />
        <Stat label="Made by" value={`${r.made_count} ${r.made_count === 1 ? 'member' : 'members'}`} />
        <Stat label="Batch" value={r.target_batch_weight ? formatAmount(Number(r.target_batch_weight), r.units) : '—'} />
        <Stat label="Rest (initial / recommended)" value={<><Clock size={12} className="mr-1 inline" aria-hidden />{formatHours(r.initial_rest_hours)} / {formatHours(r.recommended_rest_hours)}</>} />
        <Stat label="Difficulty" value={dots(r.difficulty)} />
        <Stat label="Strength (creator)" value={dots(r.creator_strength)} />
        <Stat label="Sweetness (creator)" value={dots(r.creator_sweetness)} />
        <Stat label="Flavour intensity" value={dots(r.creator_flavour_intensity)} />
        <Stat label="Cooling" value={dots(r.creator_cooling)} />
        <Stat label="Cloud" value={dots(r.creator_cloud)} />
        <Stat label="Heat tolerance" value={dots(r.creator_heat_tolerance)} />
      </dl>
      <p className="mt-2 text-xs text-mute">Characteristic scores are the creator’s own opinion. Community results appear under “Community results”.</p>

      <nav aria-label="Recipe sections" className="no-print sticky top-14 z-20 -mx-4 mt-6 overflow-x-auto border-b border-line bg-bg/95 px-4 backdrop-blur">
        <ul className="flex gap-1 whitespace-nowrap py-2 text-sm">
          {[['overview', 'Overview'], ['ingredients', 'Ingredients'], ['process', 'Process'], ['sources', 'Sources'], ['results', 'Community results'], ['reviews', 'Reviews'], ['discussion', 'Discussion'], ['versions', 'Versions']].map(([id, l]) => (
            <li key={id}><a href={`#${id}`} className="rounded px-3 py-1.5 text-mute hover:bg-raised hover:text-ink">{l}</a></li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 space-y-12">
        <section id="overview" className="scroll-mt-28 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {r.long_description && <div className="prose-lab" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.long_description) }} />}
            {r.creator_notes && <div className="card p-4"><h2 className="font-display text-lg">Creator notes</h2><div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.creator_notes) }} /></div>}
            {!r.long_description && !r.creator_notes && <p className="text-sm text-mute">The creator has not added a description.</p>}
          </div>
          <aside className="card space-y-2 p-4 text-sm">
            <h2 className="font-display text-lg">Tobacco & preparation</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {([['Tobacco', tobaccoName], ['Leaf family', r.tobacco_leaf_family], ['Leaf type', r.tobacco_leaf_type], ['Variety', r.tobacco_variety], ['Origin', r.tobacco_origin], ['Cut', r.tobacco_cut], ['Strength', r.tobacco_strength_category],
                ['Washed', r.washed == null ? null : r.washed ? `Yes${r.wash_method ? ` — ${r.wash_method}` : ''}${r.wash_duration_minutes ? `, ${r.wash_duration_minutes} min` : ''}` : 'No'],
                ['Drying', r.drying_method ? `${r.drying_method}${r.drying_duration_minutes ? `, ${r.drying_duration_minutes} min` : ''}` : null],
                ['Rest temperature', r.rest_temperature_c != null ? `${r.rest_temperature_c} °C` : null], ['Mixing', r.mixing_schedule], ['Storage', r.storage_method]] as [string, string | null][])
                .filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {r.tobacco_notes && <p className="text-mute">{r.tobacco_notes}</p>}
            {r.equipment?.length > 0 && <><h3 className="pt-2 text-xs uppercase tracking-wider text-mute">Equipment</h3><ul className="flex flex-wrap gap-1.5">{r.equipment.map((e) => <li key={e} className="chip">{e}</li>)}</ul></>}
          </aside>
        </section>

        <section id="ingredients" className="scroll-mt-28">
          <h2 className="section-title mb-4">Ingredients & scaling</h2>
          {tobaccoG ? (
            <RecipeScaler tobaccoWeightG={tobaccoG} batchWeightG={batchG} base={baseInput} aromas={aromaInput} unit={unit} tobaccoName={tobaccoName} tobaccoBrand={null} />
          ) : (
            <div className="space-y-3">
              <p className="rounded-md border border-line bg-surface p-3 text-sm text-mute">The creator did not record a tobacco weight, so scaling and percentages are unavailable. Listed ingredients are shown below as written.</p>
              <ul className="card divide-y divide-line">
                {base.map((b) => <li key={b.id} className="flex justify-between gap-3 px-4 py-2 text-sm"><span>{b.name}{b.brand && <span className="text-mute"> · {b.brand}</span>}</span><span className="text-mute">{b.weight_g != null ? formatAmount(b.weight_g, 'g') : b.volume_ml != null ? formatAmount(b.volume_ml, 'ml') : '—'}</span></li>)}
                {aromas.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-2 text-sm"><span>{a.flavour_name}{a.brand && <span className="text-mute"> · {a.brand}</span>}<span className="chip ml-2 py-0 text-[10px]">{a.role}</span></span><span className="text-mute">{a.pct_of_batch != null ? `${a.pct_of_batch}%` : a.weight_g != null ? formatAmount(a.weight_g, 'g') : '—'}</span></li>)}
              </ul>
            </div>
          )}
        </section>

        <section id="process" className="scroll-mt-28">
          <h2 className="section-title mb-4">Process</h2>
          {steps.length === 0 ? <p className="text-sm text-mute">No steps recorded.</p> : (
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.id} className="card flex gap-4 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/15 font-display text-amber" aria-hidden>{s.step_number}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium"><span className="sr-only">Step {s.step_number}: </span>{s.title}</h3>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-mute">
                      {s.category && <span className="chip py-0">{s.category}</span>}
                      {s.duration_minutes != null && <span>{formatHours(s.duration_minutes / 60)}</span>}
                      {s.temperature != null && <span>{s.temperature} °{s.temperature_unit ?? 'C'}</span>}
                    </div>
                    <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.instructions) }} />
                    {s.photo_path && publicImageUrl(s.photo_path) && <Image src={publicImageUrl(s.photo_path)!} alt={`Photo for step ${s.step_number}`} width={640} height={400} className="mt-3 h-auto max-w-full rounded-md border border-line" />}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section id="sources" className="scroll-mt-28">
          <h2 className="section-title mb-4">Sources & references</h2>
          <SourceList sources={sources} />
          <p className="mt-3 text-xs text-mute">External links are user-supplied and unverified. SHISHA LAB does not sell, broker or link to purchases of tobacco.</p>
        </section>

        <section id="results" className="scroll-mt-28 space-y-4">
          <span id="community-results" aria-hidden />
          <h2 className="section-title">Community results</h2>
          {expStats.enough ? (
            <dl className="grid gap-2 sm:grid-cols-4">
              <Stat label="Results logged" value={expStats.total} />
              <Stat label="Average overall" value={<RatingStars value={expStats.avgOverall} />} />
              <Stat label="Would make again" value={`${Math.round(expStats.makeAgainPct ?? 0)}%`} />
              <Stat label="Followed exactly" value={`${Math.round(expStats.exactPct ?? 0)}%`} />
            </dl>
          ) : (
            <p className="rounded-md border border-line bg-surface p-3 text-sm text-mute">{expStats.total} result{expStats.total === 1 ? '' : 's'} logged. Averages appear once {MIN_EXPERIMENTS_FOR_STATS} people have logged one, so a single opinion doesn’t look like a trend.</p>
          )}
          {mods.length > 0 && <p className="text-sm"><span className="text-mute">Common modifications:</span> {mods.map((m) => `${KIND_LABEL[m.kind] ?? m.kind} (${m.count})`).join(', ')}</p>}
          {r.status === 'published' && !isOwner && <ExperimentForm recipeId={r.id} versionMajor={r.version_major} versionMinor={r.version_minor} signedIn={!!viewer} loginHref={loginHref} defaultUnit={r.units} />}
          <ul className="space-y-3">
            {experiments.map((e) => (
              <li key={e.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <UserBadge profile={e.author} size={24} />
                  <RatingStars value={e.overall} showValue={false} />
                  <span className="text-xs text-mute">made {formatDate(e.made_on)} · v{e.version_major}.{e.version_minor}{e.version_major !== r.version_major || e.version_minor !== r.version_minor ? ' (older version)' : ''}</span>
                  <span className="chip py-0 text-[11px]">{e.followed_exactly ? 'Followed exactly' : 'Modified'}</span>
                  <span className="chip py-0 text-[11px]">Make again: {e.would_make_again}</span>
                </div>
                {e.changes && e.changes.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-mute">{e.changes.map((c, i) => <li key={i}><span className="text-ink/80">{KIND_LABEL[c.kind] ?? c.kind}:</span> {c.description}</li>)}</ul>}
                {e.notes && <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(e.notes, { maxLength: 5000 }) }} />}
                <div className="mt-2 text-right"><ReportDialog targetType="experiment" targetId={e.id} signedIn={!!viewer} compact /></div>
              </li>
            ))}
          </ul>
        </section>

        <section id="reviews" className="scroll-mt-28 space-y-4">
          <h2 className="section-title">Ratings & reviews</h2>
          <div className="grid gap-5 md:grid-cols-[18rem_1fr]">
            <div className="card space-y-3 p-4">
              {r.review_count > 0 ? <><div className="font-display text-4xl">{avg?.toFixed(1)}</div><RatingStars value={avg} count={r.review_count} showValue={false} size={18} /><p className="text-xs text-mute">{r.review_count} rating{r.review_count === 1 ? '' : 's'}{!hasEnoughRatings(r.review_count) && ' — too few to rank'}</p><RatingDistribution dist={r.rating_dist} /></> : <p className="text-sm text-mute">No ratings yet. Be the first.</p>}
              {maker.count > 0 && <p className="border-t border-line pt-2 text-xs text-mute">Verified Maker Rating: <span className="text-ink">{maker.avg?.toFixed(1)}</span> from {maker.count} {maker.count === 1 ? 'person who made' : 'people who made'} it.</p>}
            </div>
            <ReviewForm recipeId={r.id} existing={state.review} signedIn={!!viewer} isOwner={isOwner} loginHref={loginHref} />
          </div>
          <ul className="space-y-3">
            {reviews.map((rv) => (
              <li key={rv.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><UserBadge profile={rv.author} size={24} /><RatingStars value={rv.overall} showValue={false} /><span className="chip py-0 text-[11px]">{MAKER_LABEL[rv.maker_status]}</span><time className="text-xs text-mute" dateTime={rv.created_at}>{timeAgo(rv.created_at)}</time></div>
                {rv.body && <div className="prose-lab mt-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(rv.body, { maxLength: 5000 }) }} />}
                <div className="mt-2 text-right">{rv.user_id !== viewerId && <ReportDialog targetType="review" targetId={rv.id} signedIn={!!viewer} compact />}</div>
              </li>
            ))}
          </ul>
        </section>

        <section id="discussion" className="scroll-mt-28"><CommentThread comments={comments} ctx={ctx} /></section>

        <section id="versions" className="scroll-mt-28">
          <h2 className="section-title mb-4"><History size={20} className="mr-2 inline" aria-hidden />Version history</h2>
          <ol className="card divide-y divide-line">
            {versions.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <div><Link className="font-medium text-amber hover:underline" href={`/recipes/${r.slug}/versions/${v.version_major}.${v.version_minor}`}>{formatVersion(v.version_major, v.version_minor)}</Link>{i === 0 && <span className="chip ml-2 py-0 text-[11px]">current</span>}
                  <p className="text-mute">{v.change_notes || (v.version_major === 1 && v.version_minor === 0 ? 'First published version.' : 'No change notes.')}</p></div>
                <time className="text-xs text-mute" dateTime={v.created_at}>{formatDate(v.created_at)}</time>
              </li>
            ))}
          </ol>
        </section>

        {similar.length > 0 && <section aria-labelledby="similar-h"><h2 id="similar-h" className="section-title mb-4">Similar recipes</h2><RecipeGrid items={similar} /></section>}
      </div>
    </article>
  );
}
