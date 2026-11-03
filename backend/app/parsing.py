"""Pull a square 0/1 adjacency matrix and species names out of a spreadsheet or CSV.

Works on the group's workbook layout (names down column B, matrix starting at C6)
and on a plain CSV with a header row and a name column.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any

from openpyxl import load_workbook

MAX_SPECIES = 60


class ParseError(ValueError):
    pass


def _is01(v: Any) -> bool:
    if v is None or isinstance(v, bool):
        return False
    try:
        return float(str(v).strip()) in (0.0, 1.0) and str(v).strip() != ""
    except ValueError:
        return False


def clean_name(raw: Any, fallback: str) -> str:
    if raw is None or str(raw).strip() == "" or _is01(raw):
        return fallback
    text = re.sub(r"[_\s]+", " ", str(raw)).strip()
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", text)
    if m:
        before, inside = m.group(1).strip(), m.group(2).strip()
        # "Balaenoptera Musculus (Blue Whale)" -> common name; "Zooplankton (Animal plankton)" -> Zooplankton
        text = inside if len(before.split()) >= 2 and inside else before or inside
    return text[:40] or fallback


def find_matrix(grid: list[list[Any]]) -> tuple[list[str], list[list[int]]]:
    width = max((len(r) for r in grid), default=0)
    g = [list(r) + [None] * (width - len(r)) for r in grid]
    for r, row in enumerate(g):
        c = 0
        while c < width:
            if not _is01(row[c]):
                c += 1
                continue
            start = c
            while c < width and _is01(row[c]):
                c += 1
            run = c - start
            height = 0
            while r + height < len(g) and _is01(g[r + height][start]):
                height += 1
            n = min(run, height)
            if n < 2:
                continue
            block_ok = all(_is01(g[r + i][start + j]) for i in range(n) for j in range(n))
            if not block_ok:
                continue
            if n > MAX_SPECIES:
                raise ParseError(f"Found a {n}×{n} matrix; the limit is {MAX_SPECIES} species.")
            matrix = [[int(float(str(g[r + i][start + j]).strip())) for j in range(n)] for i in range(n)]
            row_labels = [g[r + i][start - 1] if start > 0 else None for i in range(n)]
            col_labels = [g[r - 1][start + j] if r > 0 else None for j in range(n)]
            use_rows = sum(1 for x in row_labels if x is not None and not _is01(x)) >= n // 2
            labels = row_labels if use_rows else col_labels
            names = [clean_name(labels[i], f"Species {i + 1}") for i in range(n)]
            for i in range(n):
                matrix[i][i] = 0
            return names, matrix
    raise ParseError("Couldn't find a square block of 0s and 1s. Put the matrix in one block with names beside it.")


def parse_upload(data: bytes, filename: str) -> dict[str, Any]:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        try:
            wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
        except Exception as exc:  # noqa: BLE001
            raise ParseError("That file isn't a readable Excel workbook.") from exc
        last_error: ParseError | None = None
        for ws in wb.worksheets:
            grid = [list(r) for r in ws.iter_rows(values_only=True)]
            try:
                names, matrix = find_matrix(grid)
                return {"names": names, "matrix": matrix, "sheet": ws.title}
            except ParseError as e:
                last_error = e
        raise last_error or ParseError("The workbook is empty.")
    if name.endswith((".csv", ".txt", ".tsv")):
        text = data.decode("utf-8-sig", errors="replace")
        dialect = csv.excel_tab if name.endswith(".tsv") or "\t" in text.splitlines()[0] else csv.excel
        grid = [row for row in csv.reader(io.StringIO(text), dialect)]
        names, matrix = find_matrix(grid)
        return {"names": names, "matrix": matrix, "sheet": None}
    raise ParseError("Upload an .xlsx or .csv file.")
