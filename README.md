# Reef Food Web Lab

An interactive tool for analyzing the Caribbean reef food web from our Biological Networks and Centrality project.
Edit the adjacency matrix, remove species to see who starves, and watch the centrality scores update live.

- **Backend:** Python (FastAPI + networkx + numpy) does the math
- **Frontend:** React (Vite + TypeScript) draws the matrix, food web, and rankings

---

## 1. Install the prerequisites

You need **Python 3.10 or newer** and **Node.js 18 or newer**. Check whether you already have them:

**Mac**
```bash
python3 --version
node --version
```

**Windows (PowerShell)**
```powershell
python --version
node --version
```

If both print a version number that's new enough, skip to step 2.

### Mac

1. Install Homebrew if you don't have it:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. When it finishes, Homebrew prints a **"Next steps"** section with one or two `echo ... >> ~/.zprofile` lines.
   Copy and run those lines.
3. Install Python and Node:
   ```bash
   brew install python@3.12 node@20
   ```
4. Close Terminal and open a new window so it picks up the new commands.

> On a Mac the command is `python3`, not `python`.

### Windows

1. In PowerShell:
   ```powershell
   winget install Python.Python.3.12
   winget install OpenJS.NodeJS.LTS
   ```
2. Close PowerShell and open a new window.

---

## 2. Get the code

Unzip `reef-food-web-lab.zip`, then open a terminal in the `reefweb` folder:

```bash
cd path/to/reefweb
```

Tip on Mac: type `cd ` (with a space), drag the `reefweb` folder into the Terminal window, and press Enter.

---

## 3. Launch the app

### Option A: Mac, one command (recommended)

From the `reefweb` folder:

```bash
chmod +x dev.sh
./dev.sh
```

The first run takes a minute or two while it installs packages. When you see `→ Open http://localhost:5173`,
open **http://localhost:5173** in your browser.

Press `Ctrl + C` in the terminal to stop it.

### Option B: Start the two halves by hand

You need **two terminal windows**, both starting in the `reefweb` folder.

**Terminal 1: the Python backend**

Mac:
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Windows (PowerShell):
```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Leave it running. You should see `Uvicorn running on http://127.0.0.1:8000`.

**Terminal 2: the React frontend** (same on Mac and Windows)
```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

After the first time, you can skip the `venv`, `pip install`, and `npm install` lines and just run the
`uvicorn` and `npm run dev` lines.

### Option C: Docker

If you have Docker Desktop installed:

```bash
docker compose up --build
```

Then open **http://localhost:8000** (note: port 8000, not 5173).

---

## 4. Using it

| To do this | Do this |
|---|---|
| Switch between the original and corrected data | Click **Original** or **Corrected** at the top |
| Add or remove a feeding link | Click any 0 or 1 in the matrix |
| Remove a species | Click it in the food web diagram (click again to bring it back) |
| See who starves | Removed species show a red ✕; species that lose all their prey turn yellow |
| See the matrix powers | Slide **k**; at k = 6 the matrix is all zeros |
| Rank by a different measure | Use **Size nodes by**, or click a column header in Rankings |
| Compare to the other data set | Use **Compare against**; a Δ column appears in Rankings |
| Load the group spreadsheet | Click **Upload .xlsx / .csv** and pick the workbook |
| Save results | **Export matrix** or **Export rankings** (CSV) |
| Add a new species | Type a name in the box under the matrix, then **Add species** |

**Matrix convention:** rows are prey, columns are predators. A 1 in row *i*, column *j* means species *i* is eaten by species *j*.

The Python API has its own interactive docs at **http://localhost:8000/docs**.

---

## 5. Troubleshooting

**`command not found: python`**
You're on a Mac. Use `python3` instead of `python`.

**`command not found: .venvScriptspip`** (or similar)
Those are the Windows commands. On a Mac use `.venv/bin/pip` and `.venv/bin/uvicorn`, with forward slashes.

**`command not found: python3` or `node`**
They aren't installed yet, or the terminal hasn't picked them up. Do step 1, then close and reopen the terminal.

**`permission denied: ./dev.sh`**
Run `chmod +x dev.sh` once, then try again.

**The page loads but shows "API error" or "Can't reach the Python API"**
The backend isn't running. Check Terminal 1 for an error, or restart it with the `uvicorn` command.

**`Address already in use` / port 8000 or 5173 is taken**
Something else is using the port, often an old copy of the app. On Mac, find and stop it:
```bash
lsof -i :8000
kill <PID>
```
Replace `<PID>` with the number from the second column.

**`npm install` errors**
Delete `frontend/node_modules` and `frontend/package-lock.json`, then run `npm install` again.

**Upload says it couldn't find the matrix**
The file needs one square block of 0s and 1s with species names beside it (down the left) or above it.

---

## 6. Run the tests (optional)

From the `reefweb` folder:

```bash
cd backend
.venv/bin/pytest -q
```

The tests lock in the hand-checked numbers from the presentation: Katz (barracuda 1.5139, whale 1.11),
betweenness (damselfish 5.5), average path length 49/34 ≈ 1.44, A⁶ = 0, and the extinction cascades.

---

## Project layout

```
reefweb/
├── dev.sh                    one-command launcher (Mac/Linux)
├── Dockerfile, docker-compose.yml
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py           API routes
│   │   ├── analysis.py       centrality, shortest paths, cascades, matrix powers
│   │   ├── parsing.py        reads the matrix out of .xlsx / .csv uploads
│   │   └── presets.py        original and corrected reef data
│   └── tests/test_api.py
└── frontend/
    ├── package.json
    └── src/
        ├── App.tsx           controls and state
        └── components/       MatrixEditor, WebGraph, Rankings, EigenPanel
```