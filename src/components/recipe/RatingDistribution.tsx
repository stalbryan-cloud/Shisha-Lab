import { distributionRows } from '@/lib/core/ratings';

export function RatingDistribution({ dist }: { dist: number[] }) {
  const rows = distributionRows(dist).reverse();
  return (
    <table className="w-full text-xs" aria-label="Rating distribution">
      <tbody>
        {rows.map((r) => (
          <tr key={r.stars}>
            <th scope="row" className="w-10 whitespace-nowrap py-0.5 pr-2 text-left font-normal text-mute">{r.stars} ★</th>
            <td className="w-full py-0.5"><div className="h-2 overflow-hidden rounded bg-raised"><div className="h-full bg-amber" style={{ width: `${r.pct}%` }} /></div></td>
            <td className="w-8 py-0.5 pl-2 text-right tabular-nums text-mute">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
