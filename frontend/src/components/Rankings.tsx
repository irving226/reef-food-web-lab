import type { AnalysisResult, MetricKey, NodeResult } from "../types";
import { METRICS } from "../types";

interface Props {
  nodes: NodeResult[];
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  baseline: AnalysisResult | null;
  baselineLabel?: string;
  katzWarning: string | null;
}

const COLS: MetricKey[] = ["in_degree", "out_degree", "betweenness", "katz", "eigenvector_undirected", "in_closeness", "out_closeness"];

const fmt = (v: number | null | undefined, d: number) => (v == null ? "–" : v.toFixed(d));

export default function Rankings({ nodes, metric, onMetric, baseline, baselineLabel, katzWarning }: Props) {
  const val = (n: NodeResult) => (n.status === "alive" ? n[metric] ?? -Infinity : -Infinity);
  const order = [...nodes].sort((a, b) => val(b) - val(a));
  const live = nodes.filter((n) => n.status === "alive" && n[metric] != null).map((n) => n[metric] as number);
  const max = Math.max(1e-9, ...live);
  const d = METRICS[metric].digits;

  return (
    <>
      <div className="rank-head">
        <h2>Rankings</h2>
        {baseline && <span className="pill alive">Δ vs {baselineLabel}</span>}
      </div>
      <p className="hint">
        <b>{METRICS[metric].label}:</b> {METRICS[metric].explain} Click a column header to rank by it.
        {katzWarning && <span className="warn-text"> {katzWarning}</span>}
      </p>
      <div className="res-scroll">
        <table className="res">
          <thead>
            <tr>
              <th>#</th>
              <th>Species</th>
              {COLS.map((c) => (
                <th key={c} className={`n${c === metric ? " active" : ""}`}>
                  <button className="th-btn" onClick={() => onMetric(c)}>{METRICS[c].label}</button>
                </th>
              ))}
              {baseline && <th className="n">Δ {METRICS[metric].label}</th>}
              <th style={{ minWidth: 90 }}>{METRICS[metric].label}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {order.map((n, rank) => {
              const a = n.status === "alive";
              const b = baseline?.nodes[n.index];
              const delta = a && b && b[metric] != null && n[metric] != null ? (n[metric] as number) - (b[metric] as number) : null;
              const label = n.status === "removed" ? "Removed" : n.status === "starved" ? "Starved" : n.producer ? "Producer" : "Alive";
              return (
                <tr key={n.index}>
                  <td>{a ? rank + 1 : "–"}</td>
                  <td>{n.name}</td>
                  {COLS.map((c) => (
                    <td key={c} className={`n${c === metric ? " m" : ""}`}>{a ? fmt(n[c], METRICS[c].digits) : "–"}</td>
                  ))}
                  {baseline && (
                    <td className={`n delta${delta && Math.abs(delta) > 1e-9 ? (delta > 0 ? " up" : " down") : ""}`}>
                      {delta == null ? "–" : Math.abs(delta) < 1e-9 ? "·" : `${delta > 0 ? "+" : ""}${delta.toFixed(d)}`}
                    </td>
                  )}
                  <td>{a && n[metric] != null && <div className="bar" style={{ width: `${Math.max(3, (100 * (n[metric] as number)) / max)}%` }} />}</td>
                  <td><span className={`pill ${n.status}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
