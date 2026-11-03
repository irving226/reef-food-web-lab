import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app
from app.parsing import clean_name, parse_upload
from app.presets import CORRECTED, NAMES, ORIGINAL

client = TestClient(app)


def run(matrix=CORRECTED, removed=(), alpha=0.1, k=1):
    r = client.post("/api/analyze", json={"names": NAMES, "matrix": matrix,
                                          "removed": list(removed), "alpha": alpha, "k": k})
    assert r.status_code == 200, r.text
    return r.json()


def node(res, name):
    return next(n for n in res["nodes"] if n["name"] == name)


def test_katz_matches_hand_calculation():
    res = run()
    assert node(res, "Barracuda")["katz"] == pytest.approx(1.51392)
    assert node(res, "Grouper")["katz"] == pytest.approx(1.4882)
    assert node(res, "Blue Whale")["katz"] == pytest.approx(1.11)
    assert node(run(ORIGINAL), "Blue Whale")["katz"] == pytest.approx(1.1)


def test_betweenness_and_path_length():
    res = run()
    assert node(res, "Damselfish")["betweenness"] == pytest.approx(5.5)
    assert node(res, "Zooplankton")["betweenness"] == pytest.approx(1.5)
    assert node(run(ORIGINAL), "Zooplankton")["betweenness"] == pytest.approx(0.5)
    assert res["summary"]["reachable_pairs"] == 34
    assert res["summary"]["avg_path_length"] == pytest.approx(49 / 34)


def test_nilpotent_and_powers():
    res = run(k=6)
    s = res["summary"]
    assert s["acyclic"] and s["longest_chain"] == 5 and s["nilpotent_at"] == 6
    assert s["spectral_radius"] == 0
    assert res["power"]["total"] == 0
    assert run(k=5)["power"]["total"] == 2
    assert res["power"]["totals"] == [19, 27, 23, 11, 2, 0]


def test_extinction_cascade():
    z = NAMES.index("Zooplankton")
    res = run(removed=[z])
    assert [NAMES[i] for i in res["summary"]["starved"]] == ["Blue Whale"]
    p = NAMES.index("Phytoplankton")
    starved = {NAMES[i] for i in run(removed=[p])["summary"]["starved"]}
    assert starved == {"Zooplankton", "Damselfish", "Blue Whale"}


def test_loop_makes_eigenvalue_positive_and_limits_alpha():
    m = [r[:] for r in CORRECTED]
    m[NAMES.index("Barracuda")][NAMES.index("Snapper")] = 1  # snapper eats barracuda -> loop
    res = run(m)
    assert not res["summary"]["acyclic"]
    assert res["summary"]["spectral_radius"] > 0
    assert run(m, alpha=0.9)["summary"]["katz_warning"]


def test_rejects_bad_matrix():
    r = client.post("/api/analyze", json={"names": ["a", "b"], "matrix": [[0, 2], [0, 0]]})
    assert r.status_code == 422


def test_clean_name():
    assert clean_name("Balaenoptera Musculus (Blue Whale)", "x") == "Blue Whale"
    assert clean_name("Zooplankton (Animal plankton)", "x") == "Zooplankton"
    assert clean_name("Sea_Urchin", "x") == "Sea Urchin"


def test_parses_group_workbook_layout():
    wb = Workbook()
    ws = wb.active
    ws["A3"] = "Adjacency Matrix"
    for j, n in enumerate(NAMES):
        ws.cell(5, 3 + j, n)
    for i, n in enumerate(NAMES):
        ws.cell(6 + i, 1, chr(65 + i))
        ws.cell(6 + i, 2, n + (" (Microscopic algae)" if i == 0 else ""))
        for j in range(11):
            ws.cell(6 + i, 3 + j, float(CORRECTED[i][j]))
        ws.cell(6 + i, 15, sum(CORRECTED[i]))  # degree column after a blank column
    buf = io.BytesIO()
    wb.save(buf)
    out = parse_upload(buf.getvalue(), "reef.xlsx")
    assert out["names"] == NAMES
    assert out["matrix"] == CORRECTED


def test_parses_csv():
    csv = "species,A,B,C\nA,0,1,0\nB,0,0,1\nC,0,0,0\n"
    out = parse_upload(csv.encode(), "web.csv")
    assert out["names"] == ["A", "B", "C"]
    assert out["matrix"] == [[0, 1, 0], [0, 0, 1], [0, 0, 0]]
