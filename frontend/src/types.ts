export type Status = "alive" | "removed" | "starved";

export interface NodeResult {
  index: number;
  name: string;
  status: Status;
  producer: boolean;
  level: number;
  in_degree: number | null;
  out_degree: number | null;
  betweenness: number | null;
  katz: number | null;
  eigenvector_undirected: number | null;
  in_closeness: number | null;
  out_closeness: number | null;
  out_eccentricity: number | null;
}

export interface Summary {
  species: number;
  alive: number;
  links: number;
  links_alive: number;
  starved: number[];
  removed: number[];
  acyclic: boolean;
  longest_chain: number | null;
  nilpotent_at: number | null;
  spectral_radius: number;
  reachable_pairs: number;
  avg_path_length: number | null;
  katz_warning: string | null;
  alpha: number;
}

export interface AnalysisResult {
  nodes: NodeResult[];
  summary: Summary;
  power: { k: number; matrix: number[][]; total: number; totals: number[] };
}

export interface Preset {
  label: string;
  description: string;
  names: string[];
  matrix: number[][];
}

export type MetricKey =
  | "katz"
  | "betweenness"
  | "eigenvector_undirected"
  | "in_degree"
  | "out_degree"
  | "in_closeness"
  | "out_closeness";

export const METRICS: Record<MetricKey, { label: string; digits: number; explain: string }> = {
  katz: {
    label: "Katz",
    digits: 4,
    explain: "1 + α × (sum of the Katz scores of everything it eats). High means a lot of energy flows into it, directly or through other species.",
  },
  betweenness: {
    label: "Betweenness",
    digits: 1,
    explain: "How many shortest prey-to-predator routes pass through it. High means it is a middleman.",
  },
  eigenvector_undirected: {
    label: "Eigenvector (two-way)",
    digits: 3,
    explain: "Eigenvector centrality after treating every link as two-way. High means it sits in the busiest part of the web. Loses who-eats-who.",
  },
  in_degree: { label: "Prey eaten", digits: 0, explain: "Number of 1s in its column." },
  out_degree: { label: "Eaten by", digits: 0, explain: "Number of 1s in its row." },
  in_closeness: {
    label: "In-closeness",
    digits: 3,
    explain: "How easily energy from the rest of the web reaches it in a few links.",
  },
  out_closeness: {
    label: "Out-closeness",
    digits: 3,
    explain: "How quickly its energy reaches the rest of the web.",
  },
};
