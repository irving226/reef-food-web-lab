import { useState } from "react";
import type { AnalysisResult, NodeResult } from "../types";

interface Props {
  names: string[];
  matrix: number[][];
  power?: AnalysisResult["power"];
  nodes?: NodeResult[];
  onToggle: (i: number, j: number) => void;
  onRename: (i: number, name: string) => void;
  onAdd: (name: string) => void;
  onDelete: (i: number) => void;
}

const short = (s: string) => (s.length > 9 ? s.slice(0, 8) + "…" : s);

export default function MatrixEditor({ names, matrix, power, nodes, onToggle, onRename, onAdd, onDelete }: Props) {
  const [newName, setNewName] = useState("");
  const k = power?.k ?? 1;
  const view = k > 1 && power ? power.matrix : matrix;
  const maxV = Math.max(1, ...view.flat());
  const dead = (i: number) => nodes?.[i] && nodes[i].status !== "alive";

  return (
    <>
      <h2>{k === 1 ? "Adjacency matrix A" : <>A<sup>{k}</sup>: routes of exactly {k} links</>}</h2>
      <p className="hint">
        {k === 1
          ? "Rows are prey, columns are predators. 1 means the row animal gets eaten by the column animal. Click a cell to flip it; click a name to rename."
          : `Each number counts the different food chains of exactly ${k} links from the row animal up to the column animal. Set k back to 1 to edit.`}
      </p>
      <div className="mx-scroll">
        <table className="mx">
          <thead>
            <tr>
              <th className="corner">prey ↓<br />predator →</th>
              {names.map((n, j) => (
                <th key={j} className="col" scope="col" title={n}>{short(n)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((row, i) => (
              <tr key={i}>
                <th className="row" scope="row">
                  <span className="rowhead">
                    <input
                      id={`name-${i}`}
                      aria-label={`Name of species ${i + 1}`}
                      value={names[i]}
                      onChange={(e) => onRename(i, e.target.value)}
                      disabled={k > 1}
                    />
                    {k === 1 && (
                      <button className="x" aria-label={`Delete ${names[i]}`} title="Delete species" onClick={() => onDelete(i)}>×</button>
                    )}
                  </span>
                </th>
                {row.map((v, j) =>
                  k === 1 ? (
                    <td key={j}>
                      <button
                        className={`cell${v ? " on" : ""}${i === j ? " diag" : ""}${v && (dead(i) || dead(j)) ? " dead" : ""}`}
                        disabled={i === j}
                        aria-label={`${names[i]} eaten by ${names[j]}: ${v}`}
                        onClick={() => onToggle(i, j)}
                      >
                        {v}
                      </button>
                    </td>
                  ) : (
                    <td key={j}>
                      <span
                        className="cell ro"
                        style={
                          v
                            ? {
                                background: `color-mix(in srgb, var(--accent) ${Math.round(25 + (75 * v) / maxV)}%, var(--bg))`,
                                color: 25 + (75 * v) / maxV > 55 ? "var(--surface)" : "var(--ink)",
                                borderColor: "transparent",
                              }
                            : undefined
                        }
                      >
                        {v}
                      </span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="power">
        <span>Total routes of length {k}:</span>
        <span className="big">{power?.total ?? "–"}</span>
        {power && power.total === 0 && <span className="pill removed">all zeros</span>}
        {power && power.totals.length > 1 && (
          <span className="totals" aria-label="Routes by length">
            {power.totals.map((t, idx) => (
              <span key={idx} className={idx + 1 === k ? "cur" : ""}>A<sup>{idx + 1}</sup> {t}</span>
            ))}
          </span>
        )}
      </div>
      {k === 1 && (
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            const n = newName.trim();
            if (n) {
              onAdd(n);
              setNewName("");
            }
          }}
        >
          <input id="new-species" placeholder="Add a species, e.g. Lionfish" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn" type="submit" disabled={!newName.trim()}>Add species</button>
        </form>
      )}
    </>
  );
}
