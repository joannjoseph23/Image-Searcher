import base64
import hashlib
import io
import os
from pathlib import Path
from typing import Iterable, Tuple
from pgvector.sqlalchemy import Vector   # <-- add this import

import fitz  # PyMuPDF
from dotenv import load_dotenv
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image
from sqlalchemy import text, bindparam, Integer
from fastapi import UploadFile, File
from pathlib import Path
from db import init_db, session_scope, upsert_image_page
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()  # loads .env in backend/
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="IMG Searcher Backend")

# Allow your Next.js dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Helpers ----------

def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def render_pdf_pages(pdf_path: Path, dpi: int = 150) -> Iterable[Tuple[int, bytes, Tuple[int, int]]]:
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc, start=1):
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        yield i, buf.getvalue(), (pix.width, pix.height)

def png_bytes_to_data_url(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"

def call_openai_vision(png_bytes: bytes) -> dict:
    data_url = png_bytes_to_data_url(png_bytes)
    SYSTEM = "You are an image metadata extractor. Return concise JSON only."
    USER = (
        "Extract this schema:\n"
        "{\n"
        '  "caption": "string (<= 15 words)",\n'
        '  "keywords": ["string", "..."],\n'
        '  "objects": [{"name": "string", "confidence": 0..1}],\n'
        '  "colors": ["string"],\n'
        '  "is_eyewear_present": boolean\n'
        "}\n"
        "Be accurate and avoid speculation."
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": USER},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        temperature=0.2,
    )
    import json
    return json.loads(resp.choices[0].message.content)

def embed_text(text: str) -> list[float]:
    emb = client.embeddings.create(model="text-embedding-3-large", input=text)
    return emb.data[0].embedding

def build_text_for_embedding(meta: dict, fallback_filename: str) -> str:
    caption = meta.get("caption") or ""
    keywords = meta.get("keywords") or []
    objects = [o.get("name", "") for o in meta.get("objects", [])]
    colors = meta.get("colors") or []
    eyewear = "eyewear_present" if meta.get("is_eyewear_present") else ""
    return "\n".join(
        [fallback_filename, caption, " ".join(keywords), " ".join(objects), " ".join(colors), eyewear]
    ).strip()

# ---------- Core pipeline ----------

def process_pdf(pdf_path: Path, web_path_for_ui: str | None = None):
    sha = file_sha256(pdf_path)
    pdf_filename = pdf_path.name
    web_path = web_path_for_ui or f"/samples/{pdf_filename}"

    for page_number, png_bytes, (w, h) in render_pdf_pages(pdf_path):
        meta = call_openai_vision(png_bytes)
        text_for_embedding = build_text_for_embedding(meta, fallback_filename=pdf_filename)
        vector = embed_text(text_for_embedding)

        row_id = f"{sha}-p{page_number}"
        with session_scope() as s:
            upsert_image_page(
                s,
                id=row_id,
                pdf_filename=pdf_filename,
                pdf_path=web_path,
                page_number=page_number,
                width=w,
                height=h,
                size_bytes=len(png_bytes),
                caption=meta.get("caption"),
                keywords=meta.get("keywords"),
                raw_metadata=meta,
                embedding=vector,
            )
        print(f"✓ Stored {pdf_filename} page {page_number}")

# ---------- API ----------
SAMPLES_DIR = (Path(__file__).resolve().parents[1] / "frontend" / "public" / "samples")
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    # save into Next.js public/samples so the browser can reach it at /samples/<name>
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    target = SAMPLES_DIR / file.filename
    with target.open("wb") as f:
        f.write(await file.read())

    # run your existing pipeline (renders page 1, hits OpenAI, stores to Postgres)
    process_pdf(target, web_path_for_ui=f"/samples/{file.filename}")

    return {"ok": True, "file": file.filename, "web_path": f"/samples/{file.filename}"}
@app.post("/admin/cleanup-missing")
def cleanup_missing():
    removed: list[str] = []
    with session_scope() as s:
        rows = s.execute(text("SELECT DISTINCT pdf_filename, pdf_path FROM image_pages")).all()
        for fn, web_path in rows:
            fs_path = SAMPLES_DIR / Path(web_path).name
            if not fs_path.exists():
                s.execute(text("DELETE FROM image_pages WHERE pdf_filename = :fn"), {"fn": fn})
                removed.append(fn)
        s.commit()
    return {"ok": True, "removed": removed}
@app.get("/health")
def health():
    return {"ok": True}
@app.get("/debug/db")
def debug_db():
    # Count rows + return a few examples so you know it's connected
    with session_scope() as s:
        count = s.execute(text("SELECT count(*) FROM image_pages")).scalar_one()
        rows = s.execute(
            text("""
                SELECT id, pdf_filename, page_number, caption, keywords, pdf_path
                FROM image_pages
                ORDER BY id DESC
                LIMIT 10
            """)
        ).mappings().all()
    return {"ok": True, "count": count, "sample": [dict(r) for r in rows]}
@app.get("/items")
def items():
    with session_scope() as s:
        rows = s.execute(text("""
            SELECT id, pdf_filename, page_number, caption, keywords, pdf_path
            FROM image_pages
            ORDER BY pdf_filename, page_number
        """)).mappings().all()

    def exists(r):
        p = SAMPLES_DIR / Path(r["pdf_path"]).name
        return p.exists()

    return {"ok": True, "items": [dict(r) for r in rows if exists(r)]}

@app.post("/ingest/scan")
def ingest_scan(folder: str = "../frontend/public/samples"):
    # same as /ingest/local – it will upsert and skip existing pages
    return ingest_local(folder)

@app.post("/ingest/local")
def ingest_local(folder: str = "../frontend/public/samples"):
    folder_path = Path(folder).resolve()
    if not folder_path.exists():
        return {"ok": False, "error": f"Folder not found: {folder_path}"}
    pdfs = sorted(folder_path.glob("*.pdf"))
    if not pdfs:
        return {"ok": False, "error": f"No PDFs in {folder_path}"}
    for pdf in pdfs:
        web_path = f"/samples/{pdf.name}"
        process_pdf(pdf, web_path_for_ui=web_path)
    return {"ok": True, "processed": len(pdfs)}

@app.post("/search")
def search(q: str = Body(embed=True), k: int = 24):
    q = (q or "").strip()
    if not q:
        return {"ok": True, "results": []}

    # 1) Embed the query
    vec = client.embeddings.create(
        model="text-embedding-3-large", input=q
    ).data[0].embedding

    # 2) SQL with typed bind params (so :query_vec is a pgvector)
    sql = text("""
        SELECT id, pdf_filename, page_number, caption, keywords, pdf_path,
               1 - (embedding <=> :query_vec) AS score
        FROM image_pages
        ORDER BY embedding <=> :query_vec
        LIMIT :k
    """).bindparams(
        bindparam("query_vec", type_=Vector(3072)),
        bindparam("k", type_=Integer),
    )

    with session_scope() as s:
        rows = s.execute(sql, {"query_vec": vec, "k": k}).mappings().all()

    return {"ok": True, "results": [dict(r) for r in rows]}
# ---------- CLI ----------

if __name__ == "__main__":
    init_db()
    samples = Path(__file__).resolve().parents[1] / "frontend" / "public" / "samples"
    print(f"Ingesting from: {samples}")
    for p in sorted(samples.glob("*.pdf")):
        process_pdf(p, web_path_for_ui=f"/samples/{p.name}")
