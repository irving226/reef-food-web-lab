import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, getPresets, uploadMatrix } from "./api";
import type { AnalysisResult, MetricKey, Preset } from "./types";
import { METRICS } from "./types";
import MatrixEditor from "./components/MatrixEditor";
import WebGraph from "./components/WebGraph";
import Rankings from "./components/Rankings";
import EigenPanel from "./components/EigenPanel";
import { downloadCsv } from "./csv";

type PresetKey = string;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export default function App() {
  const [presets, setPresets] = useState<Record<PresetKey, Preset>>({});
  const [names, setNames] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [alpha, setAlpha] = useState(0.1);
  const [k, setK] = useState(1);
  const [metric, setMetric] = useState<MetricKey>("katz");
  const [compareTo, setCompareTo] = useState<PresetKey | "none">("none");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [baseline, setBaseline] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load presets, start on the corrected web
  useEffect(() => {
    getPresets()
      .then((p) => {
        setPresets(p);
        const start = p.corrected ?? Object.values(p)[0];
        setNames(start.names);
        setMatrix(start.matrix);
        setCompareTo(p.original ? "original" : "none");
      })
      .catch((e: Error) =>
        setError(
          `Can't reach the Python API: ${e.message}. Is the backend running on port 8000?`
        )
      );
  }, []);

  const activePreset = useMemo(
    () =>
      Object.entries(presets).find(
        ([, p]) => same(p.names, names) && same(p.matrix, matrix)
      )?.[0] ?? "custom",
    [presets, names, matrix]
  );

  // Analyze current web (debounced, cancel stale requests)
  useEffect(() => {
    if (!names.length) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      analyze({ names, matrix, removed, alpha, k }, ctrl.signal)
        .then((r) => {
          setResult(r);
          setError(null);
        })
        .catch((e: Error) => e.name !== "AbortError" && setError(e.message))
        .finally(() => setBusy(false));
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [names, matrix, removed, alpha, k]);

  // Baseline for before/after comparison: same species, same removals, same alpha
  const base = compareTo !== "none" ? presets[compareTo] : undefined;
  const comparable =
    !!base && same(base.names, names) && compareTo !== activePreset;
  useEffect(() => {
    if (!comparable || !base) {
      setBaseline(null);
      return;
    }
    const ctrl = new AbortController();
    analyze(
      { names: base.names, matrix: base.matrix, removed, alpha, k: 1 },
      ctrl.signal
    )
      .then(setBaseline)
      .catch(() => setBaseline(null));
    return () => ctrl.abort();
  }, [comparable, base, removed, alpha]);

  const loadPreset = (key: PresetKey) => {
    const p = presets[key];
    setNames(p.names);
    setMatrix(p.matrix);
    setRemoved([]);
  };

  const toggleCell = (i: number, j: number) => {
    if (i === j) return;
    setMatrix((m) =>
      m.map((row, r) =>
        r === i ? row.map((v, c) => (c === j ? 1 - v : v)) : row
      )
    );
  };

  const toggleSpecies = (i: number) =>
    setRemoved((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]));

  const renameSpecies = (i: number, name: string) =>
    setNames((n) => n.map((x, idx) => (idx === i ? name : x)));

  const addSpecies = (name: string) => {
    if (names.length >= 60) return setNotice("The limit is 60 species.");
    setNames((n) => [...n, name]);
    setMatrix((m) => [
      ...m.map((row) => [...row, 0]),
      Array(m.length + 1).fill(0),
    ]);
  };

  const deleteSpecies = (i: number) => {
    if (names.length <= 2) return setNotice("Keep at least 2 species.");
    setNames((n) => n.filter((_, idx) => idx !== i));
    setMatrix((m) =>
      m.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== i))
    );
    setRemoved((r) => r.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
  };

  const onUpload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const out = await uploadMatrix(f);
      setNames(out.names);
      setMatrix(out.matrix);
      setRemoved([]);
      setNotice(
        `Loaded ${out.names.length} species from ${f.name}${
          out.sheet ? ` (sheet "${out.sheet}")` : ""
        }.`
      );
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportMatrix = () =>
    downloadCsv("adjacency_matrix.csv", [
      ["prey \\ predator", ...names],
      ...matrix.map((row, i) => [names[i], ...row]),
    ]);

  const exportRankings = () => {
    if (!result) return;
    const keys = Object.keys(METRICS) as MetricKey[];
    downloadCsv("rankings.csv", [
      [
        "Species",
        "Status",
        ...keys.map((m) => METRICS[m].label),
        "Out-eccentricity",
      ],
      ...result.nodes.map((n) => [
        n.name,
        n.status,
        ...keys.map((m) => n[m] ?? ""),
        n.out_eccentricity ?? "",
      ]),
    ]);
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const s = result?.summary;

  return (
    <div className="wrap">
      <header className="head">
        <div>
          <div className="eyebrow">Adjacency matrix</div>
          <h1>Reef Food Web Lab</h1>
          <p className="lede">
            Edit the matrix and the Python backend recomputes everything with
            networkx and numpy. Click an animal to wipe it out and see who
            starves. Slide <span className="mono">k</span> to watch A
            <sup>k</sup> run out of routes.
          </p>
        </div>
        <span className={`api ${error ? "down" : busy ? "busy" : "up"}`}>
          {error ? "API error" : busy ? "Computing…" : "API connected"}
        </span>
      </header>

      <div className="controls">
        <div className="ctl">
          <span className="lab">Data</span>
          <div className="seg">
            {Object.entries(presets).map(([key, p]) => (
              <button
                key={key}
                id={`preset-${key}`}
                aria-pressed={activePreset === key}
                onClick={() => loadPreset(key)}
                title={p.description}
              >
                {p.label}
              </button>
            ))}
            <button
              aria-pressed={activePreset === "custom"}
              disabled={activePreset !== "custom"}
            >
              Custom
            </button>
          </div>
        </div>
        <div className="ctl">
          <label htmlFor="metric">Size nodes by</label>
          <select
            id="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
          >
            {(Object.keys(METRICS) as MetricKey[]).map((m) => (
              <option key={m} value={m}>
                {METRICS[m].label}
              </option>
            ))}
          </select>
        </div>
        <div className="ctl">
          <label htmlFor="compare">Compare against</label>
          <select
            id="compare"
            value={compareTo}
            onChange={(e) => setCompareTo(e.target.value)}
          >
            <option value="none">Nothing</option>
            {Object.entries(presets).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ctl">
          <label htmlFor="alpha">
            Katz α <span className="mono">{alpha.toFixed(2)}</span>
          </label>
          <input
            id="alpha"
            type="range"
            min={0.01}
            max={0.5}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(+e.target.value)}
          />
        </div>
        <div className="ctl">
          <label htmlFor="kpow">
            Show A<sup>k</sup>, k = <span className="mono">{k}</span>
          </label>
          <input
            id="kpow"
            type="range"
            min={1}
            max={Math.max(7, (s?.nilpotent_at ?? 6) + 1)}
            step={1}
            value={k}
            onChange={(e) => setK(+e.target.value)}
          />
        </div>
        <div className="ctl actions">
          <span className="lab">Files</span>
          <div className="row">
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Upload .xlsx / .csv
            </button>
            <input
              ref={fileRef}
              id="upload"
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv,.txt"
              hidden
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <button className="btn" onClick={exportMatrix}>
              Export matrix
            </button>
            <button className="btn" onClick={exportRankings} disabled={!result}>
              Export rankings
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="banner bad" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="banner" role="status">
          {notice}
        </div>
      )}

      {s && (
        <div className="chips">
          <span className="chip">
            Feeding links <b>{s.links}</b>
          </span>
          <span className="chip">
            Species alive{" "}
            <b>
              {s.alive}/{s.species}
            </b>
          </span>
          {removed.length > 0 && (
            <span className="chip bad">
              Removed <b>{removed.length}</b>
            </span>
          )}
          {s.starved.length > 0 && (
            <span className="chip warn">
              Starved <b>{s.starved.length}</b>:{" "}
              {s.starved.map((i) => names[i]).join(", ")}
            </span>
          )}
          {s.avg_path_length != null && (
            <span className="chip">
              Avg path length <b>{s.avg_path_length.toFixed(3)}</b>
            </span>
          )}
          {s.acyclic ? (
            <span className="chip">
              Longest chain <b>{s.longest_chain}</b> links
            </span>
          ) : (
            <span className="chip warn">Loop in the web</span>
          )}
          {removed.length > 0 && (
            <button className="chip linkish" onClick={() => setRemoved([])}>
              Bring everyone back
            </button>
          )}
        </div>
      )}

      {s && <EigenPanel summary={s} onShowPower={(p) => setK(p)} />}

      <div className="main">
        <section className="panel">
          <MatrixEditor
            names={names}
            matrix={matrix}
            power={result?.power}
            nodes={result?.nodes}
            onToggle={toggleCell}
            onRename={renameSpecies}
            onAdd={addSpecies}
            onDelete={deleteSpecies}
          />
        </section>
        <section className="panel">
          <h2>Food web</h2>
          <p className="hint">
            Arrows point from prey up to predator. Click an animal to remove it;
            click again to bring it back.
          </p>
          {result && (
            <WebGraph
              names={names}
              matrix={matrix}
              nodes={result.nodes}
              metric={metric}
              onToggle={toggleSpecies}
            />
          )}
          <div className="legend">
            <span>
              <i className="dot" style={{ background: "var(--accent)" }} />
              Alive
            </span>
            <span>
              <i className="dot" style={{ background: "var(--gone)" }} />
              Removed by you
            </span>
            <span>
              <i className="dot" style={{ background: "var(--starve)" }} />
              Starved
            </span>
          </div>
        </section>
      </div>

      {result && (
        <section className="panel">
          <Rankings
            nodes={result.nodes}
            metric={metric}
            onMetric={setMetric}
            baseline={comparable ? baseline : null}
            baselineLabel={base?.label}
            katzWarning={result.summary.katz_warning}
          />
        </section>
      )}
    </div>
  );
}
