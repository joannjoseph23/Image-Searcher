import base64
import hashlib
import io
import os
from pathlib import Path
from typing import Iterable, Tuple

import fitz  # PyMuPDF
from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI
from PIL import Image

from db import init_db, session_scope, upsert_image_page

load_dotenv()  # loads .env in backend/
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="IMG Searcher Backend")

# ---------- Helpers ----------

def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def render_pdf_pages(pdf_path: Path, dpi: int = 150) -> Iterable[Tuple[int, bytes, Tuple[int, int]]]:
    """
    Yields (page_number, png_bytes, (width,height)) for each page.
    """
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc, start=1):
        mat = fitz.Matrix(dpi/72, dpi/72)  # scale
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        yield i, buf.getvalue(), (pix.width, pix.height)

def png_bytes_to_data_url(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"

def call_openai_vision(png_bytes: bytes) -> dict:
    """
    Ask for structured JSON describing the image.
    """
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
        [
            fallback_filename,
            caption,
            " ".join(keywords),
            " ".join(objects),
            " ".join(colors),
            eyewear,
        ]
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

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/ingest/local")
def ingest_local(folder: str = "../frontend/public/samples"):
    """
    Process all PDFs in a local folder (default points to your dev samples).
    """
    folder_path = Path(folder).resolve()
    if not folder_path.exists():
        return {"ok": False, "error": f"Folder not found: {folder_path}"}

    pdfs = sorted(folder_path.glob("*.pdf"))
    if not pdfs:
        return {"ok": False, "error": f"No PDFs in {folder_path}"}

    for pdf in pdfs:
        # When serving via Next.js public/, this web path works in your UI
        web_path = f"/samples/{pdf.name}"
        process_pdf(pdf, web_path_for_ui=web_path)

    return {"ok": True, "processed": len(pdfs)}

# ---------- CLI ----------

if __name__ == "__main__":
    init_db()
    # Run as a one-off to ingest your dev PDFs:
    samples = Path(__file__).resolve().parents[1] / "frontend" / "public" / "samples"
    print(f"Ingesting from: {samples}")
    for p in sorted(samples.glob("*.pdf")):
        process_pdf(p, web_path_for_ui=f"/samples/{p.name}")
