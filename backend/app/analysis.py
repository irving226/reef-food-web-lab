"""Food-web math: centrality, extinction cascades, matrix powers, eigenvalues.

All functions take an adjacency matrix where A[i][j] = 1 means i is eaten by j
(an edge i -> j, energy flowing from prey to predator).
"""

from __future__ import annotations

from typing import Any

import networkx as nx
import numpy as np


def survivors(A: np.ndarray, removed: set[int]) -> tuple[set[int], list[int], list[bool]]:
    """Remove species, then repeatedly starve any consumer whose prey are all gone.

    Producers (species that eat nothing in the matrix) never starve.
    Returns (alive, starved in the order they died, producer flags).
    """
    n = A.shape[0]
    producer = [not A[:, i].any() for i in range(n)]
    alive = set(range(n)) - removed
    starved: list[int] = []
    changed = True
    while changed:
        changed = False
        for i in sorted(alive):
            if producer[i]:
                continue
            prey = np.flatnonzero(A[:, i])
            if len(prey) and not any(int(p) in alive for p in prey):
                alive.discard(i)
                starved.append(i)
                changed = True
    return alive, starved, producer


def trophic_levels(A: np.ndarray) -> tuple[list[int], bool]:
    """Longest chain of feeding links from a producer up to each species.

    Returns (levels, is_acyclic). With loops, levels are capped at n - 1.
    """
    n = A.shape[0]
    G = nx.DiGraph()
    G.add_nodes_from(range(n))
    G.add_edges_from(zip(*np.nonzero(A)))
    if nx.is_directed_acyclic_graph(G):
        lv = [0] * n
        for v in nx.topological_sort(G):
            for u in G.predecessors(v):
                lv[v] = max(lv[v], lv[u] + 1)
        return lv, True
    lv = [0] * n
    for _ in range(n):
        for i, j in zip(*np.nonzero(A)):
            if lv[j] < lv[i] + 1:
                lv[j] = min(lv[i] + 1, n - 1)
    return lv, False


def katz(A: np.ndarray, alive: set[int], alpha: float) -> tuple[list[float | None], str | None]:
    """Unnormalized Katz centrality: x = 1 + alpha * A^T x, so x = (I - alpha A^T)^-1 1.

    Only alive species take part. Returns (scores, warning).
    """
    idx = sorted(alive)
    out: list[float | None] = [None] * A.shape[0]
    if not idx:
        return out, None
    B = A[np.ix_(idx, idx)].astype(float)
    rho = max(abs(np.linalg.eigvals(B))) if len(idx) else 0.0
    if alpha * rho >= 1:
        return out, (
            f"Katz needs α < 1/λ = {1 / rho:.3f} for this web (it has a loop with λ ≈ {rho:.3f}). "
            "Turn α down."
        )
    x = np.linalg.solve(np.eye(len(idx)) - alpha * B.T, np.ones(len(idx)))
    for k, i in enumerate(idx):
        out[i] = float(x[k])
    return out, None


def undirected_eigenvector(A: np.ndarray, alive: set[int]) -> list[float | None]:
    """Eigenvector centrality after treating every link as two-way, scaled so the max is 1."""
    idx = sorted(alive)
    out: list[float | None] = [None] * A.shape[0]
    if not idx:
        return out
    B = A[np.ix_(idx, idx)]
    U = ((B + B.T) > 0).astype(float)
    if not U.any():
        for i in idx:
            out[i] = 0.0
        return out
    _, vecs = np.linalg.eigh(U)
    v = np.abs(vecs[:, -1])
    v = v / v.max()
    for k, i in enumerate(idx):
        out[i] = float(v[k])
    return out


def analyze(names: list[str], matrix: list[list[int]], removed: list[int],
            alpha: float = 0.1, k: int = 1) -> dict[str, Any]:
    A = np.array(matrix, dtype=np.int64)
    n = A.shape[0]
    alive, starved, producer = survivors(A, set(removed))
    levels, acyclic = trophic_levels(A)

    # Graph of the surviving web
    G = nx.DiGraph()
    G.add_nodes_from(alive)
    G.add_edges_from((int(i), int(j)) for i, j in zip(*np.nonzero(A)) if i in alive and j in alive)

    btw = nx.betweenness_centrality(G, normalized=False) if len(G) else {}
    in_close = nx.closeness_centrality(G) if len(G) else {}
    out_close = nx.closeness_centrality(G.reverse()) if len(G) else {}
    katz_scores, katz_warning = katz(A, alive, alpha)
    eig_u = undirected_eigenvector(A, alive)

    dist = dict(nx.all_pairs_shortest_path_length(G))
    pair_lengths = [d for s, row in dist.items() for t, d in row.items() if s != t]

    nodes = []
    for i in range(n):
        a = i in alive
        reach = [d for t, d in dist.get(i, {}).items() if t != i] if a else []
        status = "removed" if i in removed else "starved" if i in starved else "alive"
        nodes.append({
            "index": i,
            "name": names[i],
            "status": status,
            "producer": producer[i],
            "level": levels[i],
            "in_degree": G.in_degree(i) if a else None,
            "out_degree": G.out_degree(i) if a else None,
            "betweenness": btw.get(i) if a else None,
            "katz": katz_scores[i],
            "eigenvector_undirected": eig_u[i],
            "in_closeness": in_close.get(i) if a else None,
            "out_closeness": out_close.get(i) if a else None,
            "out_eccentricity": max(reach) if reach else None,
        })

    # Structure of the full matrix (before any removals)
    total_by_power = []
    P = np.eye(n, dtype=np.int64)
    shown = None
    nilpotent_at = None
    for p in range(1, max(k, n) + 1):
        P = P @ A
        total = int(P.sum())
        total_by_power.append(total)
        if p == k:
            shown = P.copy()
        if total == 0 and nilpotent_at is None:
            nilpotent_at = p
            if p >= k:
                break
    if shown is None:  # k beyond the point where A^k is already zero
        shown = np.zeros_like(A)

    eigvals = np.linalg.eigvals(A.astype(float)) if n else np.array([])
    rho = float(max(abs(eigvals))) if n else 0.0

    return {
        "nodes": nodes,
        "summary": {
            "species": n,
            "alive": len(alive),
            "links": int(A.sum()),
            "links_alive": G.number_of_edges(),
            "starved": starved,
            "removed": sorted(removed),
            "acyclic": acyclic,
            "longest_chain": max(levels) if acyclic and n else None,
            "nilpotent_at": nilpotent_at,
            "spectral_radius": rho if rho > 1e-9 else 0.0,
            "reachable_pairs": len(pair_lengths),
            "avg_path_length": (sum(pair_lengths) / len(pair_lengths)) if pair_lengths else None,
            "katz_warning": katz_warning,
            "alpha": alpha,
        },
        "power": {"k": k, "matrix": shown.tolist(), "total": int(shown.sum()),
                  "totals": total_by_power[: max(k, nilpotent_at or 0)]},
    }
