from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from .analysis import analyze
from .parsing import MAX_SPECIES, ParseError, parse_upload
from .presets import PRESETS

app = FastAPI(title="Reef Food Web Lab API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    names: list[str] = Field(min_length=1, max_length=MAX_SPECIES)
    matrix: list[list[int]]
    removed: list[int] = []
    alpha: float = Field(0.1, gt=0, lt=1)
    k: int = Field(1, ge=1, le=20)

    @model_validator(mode="after")
    def check_shape(self) -> "AnalyzeRequest":
        n = len(self.names)
        if len(self.matrix) != n or any(len(r) != n for r in self.matrix):
            raise ValueError(f"matrix must be {n}×{n} to match the species list")
        if any(v not in (0, 1) for r in self.matrix for v in r):
            raise ValueError("matrix entries must be 0 or 1")
        if any(not 0 <= i < n for i in self.removed):
            raise ValueError("removed contains an index outside the species list")
        return self


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/presets")
def presets() -> dict:
    return PRESETS


@app.post("/api/analyze")
def run_analysis(req: AnalyzeRequest) -> dict:
    return analyze(req.names, req.matrix, req.removed, req.alpha, req.k)


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if len(data) > 5_000_000:
        raise HTTPException(413, "File is over 5 MB.")
    try:
        return parse_upload(data, file.filename or "")
    except ParseError as e:
        raise HTTPException(422, str(e)) from e


# In production (docker), serve the built React app from the same server.
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        target = STATIC_DIR / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")
