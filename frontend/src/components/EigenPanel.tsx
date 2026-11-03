import type { Summary } from "../types";

export default function EigenPanel({ summary: s, onShowPower }: { summary: Summary; onShowPower: (k: number) => void }) {
  if (s.acyclic && s.nilpotent_at) {
    return (
      <div className="eig">
        <strong>Why eigenvector centrality fails here.</strong> Food only flows up, never back around. The longest chain is{" "}
        {s.longest_chain} links, so A<sup>{s.nilpotent_at}</sup> is all zeros and every eigenvalue is 0. Eigenvector centrality gives
        everyone 0, so we use Katz, which starts every species at 1.{" "}
        <button className="inline" onClick={() => onShowPower(s.nilpotent_at!)}>
          Show A<sup>{s.nilpotent_at}</sup>
        </button>
      </div>
    );
  }
  return (
    <div className="eig">
      <strong>Loop detected.</strong> Some species can reach itself through the web, so A<sup>k</sup> never runs out of routes. Largest
      eigenvalue λ ≈ <span className="mono">{s.spectral_radius.toFixed(3)}</span>, so directed eigenvector centrality would now work.
      Katz needs α &lt; 1/λ ≈ <span className="mono">{(1 / s.spectral_radius).toFixed(3)}</span>.
    </div>
  );
}
