import { useMemo, useState } from "react";
import type { MetricKey, NodeResult } from "../types";
import { METRICS } from "../types";

interface Props {
  names: string[];
  matrix: number[][];
  nodes: NodeResult[];
  metric: MetricKey;
  onToggle: (i: number) => void;
}

const W = 640;
const H = 560;
const TOP = 40;
const BOT = 520;

function layout(matrix: number[][], nodes: NodeResult[]) {
  const n = nodes.length;
  const lv = nodes.map((d) => d.level);
  const maxL = Math.max(1, ...lv);
  const x = Array(n).fill(W / 2);
  const y = lv.map((l) => BOT - ((BOT - TOP) * l) / maxL);
  for (let l = 0; l <= maxL; l++) {
    const layer = nodes.filter((d) => d.level === l).map((d) => d.index);
    if (l > 0) {
      const bc = (v: number) => {
        const prey = matrix
          .map((row, j) => (row[v] ? j : -1))
          .filter((j) => j >= 0);
        return prey.length
          ? prey.reduce((s, j) => s + x[j], 0) / prey.length
          : W / 2;
      };
      layer.sort((a, b) => bc(a) - bc(b));
    }
    layer.forEach((v, idx) => {
      x[v] =
        layer.length === 1
          ? W / 2
          : layer.length === 2
          ? W * (idx ? 0.7 : 0.3)
          : 70 + ((W - 140) * idx) / (layer.length - 1);
    });
  }
  return { x, y, lv };
}

export default function WebGraph({
  names,
  matrix,
  nodes,
  metric,
  onToggle,
}: Props) {
  const [hover, setHover] = useState(-1);
  const { x, y, lv } = useMemo(() => layout(matrix, nodes), [matrix, nodes]);
  const alive = (i: number) => nodes[i]?.status === "alive";

  const vals = nodes.map((d) => d[metric]);
  const liveVals = vals.filter((v, i): v is number => alive(i) && v != null);
  const max = Math.max(1e-9, ...liveVals);
  const min = metric === "katz" ? Math.min(...liveVals, max) : 0;
  const top = nodes.reduce((best, d) => {
    const v = vals[d.index];
    return d.status === "alive" &&
      v != null &&
      (best < 0 || v > (vals[best] as number))
      ? d.index
      : best;
  }, -1);
  const rad = (i: number) => {
    const v = vals[i];
    if (!alive(i) || v == null) return 12;
    const t = max - min > 1e-9 ? (v - min) / (max - min) : 1;
    return 11 + 16 * t;
  };

  const edges: JSX.Element[] = [];
  matrix.forEach((row, i) =>
    row.forEach((v, j) => {
      if (!v || i >= nodes.length || j >= nodes.length) return;
      const dx = x[j] - x[i],
        dy = y[j] - y[i],
        len = Math.hypot(dx, dy) || 1,
        ux = dx / len,
        uy = dy / len;
      const x1 = x[i] + ux * (rad(i) + 2),
        y1 = y[i] + uy * (rad(i) + 2);
      const x2 = x[j] - ux * (rad(j) + 4),
        y2 = y[j] - uy * (rad(j) + 4);
      const dead = !alive(i) || !alive(j);
      const hi = !dead && (hover === i || hover === j);
      const bend = Math.abs(dx) < 4 && Math.abs(lv[j] - lv[i]) > 1 ? 40 : 0;
      const back = lv[j] <= lv[i]; // loop edge pointing down or sideways
      edges.push(
        <path
          key={`${i}-${j}`}
          className={`edge${dead ? " dim" : ""}${hi ? " hi" : ""}${
            back ? " back" : ""
          }`}
          d={`M${x1},${y1} Q${(x1 + x2) / 2 + bend + (back ? 50 : 0)},${
            (y1 + y2) / 2
          } ${x2},${y2}`}
          markerEnd={`url(#ar-${hi ? "h" : back ? "b" : "e"})`}
        />
      );
    })
  );

  return (
    <svg
      className="web"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Food web diagram"
      onMouseLeave={() => setHover(-1)}
    >
      <defs>
        {(["e", "h", "b"] as const).map((k) => (
          <marker
            key={k}
            id={`ar-${k}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              d="M0,0 L10,5 L0,10 z"
              style={{
                fill: `var(${
                  k === "h" ? "--accent" : k === "b" ? "--starve" : "--edge"
                })`,
              }}
            />
          </marker>
        ))}
      </defs>
      {edges}
      {nodes.map((d) => {
        const i = d.index;
        const r = rad(i);
        const color =
          d.status === "removed"
            ? "--gone"
            : d.status === "starved"
            ? "--starve"
            : i === top
            ? "--coral"
            : "--accent";
        const right = x[i] > W - 150;
        const lx = right ? x[i] - r - 7 : x[i] + r + 7;
        const v = vals[i];
        return (
          <g
            key={i}
            className={`node${i === top ? " top" : ""}`}
            tabIndex={0}
            role="button"
            aria-label={`${d.status === "alive" ? "Remove" : "Restore"} ${
              names[i]
            }`}
            onClick={() => onToggle(i)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") &&
              (e.preventDefault(), onToggle(i))
            }
            onMouseEnter={() => setHover(i)}
          >
            <circle
              cx={x[i]}
              cy={y[i]}
              r={r}
              style={{
                fill: `var(${color})`,
                fillOpacity: d.status === "alive" ? 0.9 : 0.25,
                stroke: `var(${color})`,
                strokeWidth: 2,
                strokeDasharray: d.status === "alive" ? undefined : "3 3",
              }}
            />
            {d.status === "removed" && (
              <path
                d={`M${x[i] - 6},${y[i] - 6}L${x[i] + 6},${y[i] + 6}M${
                  x[i] + 6
                },${y[i] - 6}L${x[i] - 6},${y[i] + 6}`}
                style={{
                  stroke: "var(--gone)",
                  strokeWidth: 2.5,
                  fill: "none",
                }}
              />
            )}
            <text
              className="lbl"
              x={lx}
              y={y[i] - 1}
              textAnchor={right ? "end" : "start"}
            >
              {names[i]}
            </text>
            {d.status === "alive" && v != null && (
              <text
                className="num"
                x={lx}
                y={y[i] + 13}
                textAnchor={right ? "end" : "start"}
              >
                {v.toFixed(METRICS[metric].digits)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
