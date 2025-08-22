import os, io, json, base64, uuid
from typing import List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
import fitz      # PyMuPDF
from PIL import Image
from dotenv import load_dotenv
from openai import OpenAI

from db import get_db

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing")
client = OpenAI(api_key=OPENAI_API_KEY)

OPENAI_MODEL_VISION = os.getenv("OPENAI_MODEL_VISION", "gpt-4o")
OPENAI_MODEL_EMBED  = os.getenv("OPENAI_MODEL_EMBED", "text-embedding-3-small")
RENDER_DPI = int(os.getenv("RENDER_DPI", "300"))

SCHEMA_PROMPT = open("schema_prompt.txt", "r", encoding="utf-8").read()

app = FastAPI(title="Image Searcher Backend")

# CORS for your Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestResponse(BaseModel):
    file_id: str
    pages_indexed: int

def bytes_to_data_url_png(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return "data:image/png;base64," + b64

def rasterize_pdf(pdf_bytes: bytes, dpi: int):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        yield (i+1, pix.tobytes("png"), pix.width, pix.height)

def extract_features(png_bytes: bytes) -> dict:
    r = client.chat.completions.create(
        model=OPENAI_MODEL_VISION,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SCHEMA_PROMPT},
            {"role": "user", "content": [
                {"type": "input_text", "text": "Index this page image per the schema."},
                {"type": "input_image", "image_url": bytes_to_data_url_png(png_bytes)}
            ]}
        ]
    )
    return json.loads(r.choices[0].message.content)

def build_embed_text(feats: dict) -> str:
    colors = (feats.get("colors") or {})
    chart = (feats.get("chart") or {})
    text = (feats.get("text") or {})
    parts = [
        feats.get("caption",""),
        "types: " + " ".join(feats.get("content_types", [])),
        "colors: " + " ".join(colors.get("color_names", [])),
        "chart: " + (chart.get("type") or "none") + " topics " + " ".join(chart.get("topic_keywords", [])),
        "text: " + (text.get("summary") or "")
    ]
    return ". ".join(p for p in parts if p)

def embed(text_str: str) -> List[float]:
    e = client.embeddings.create(model=OPENAI_MODEL_EMBED, input=text_str)
    return e.data[0].embedding

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/ingest", response_model=IngestResponse)
async def ingest(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDFs are supported.")

    pdf_bytes = await file.read()

    # Insert file row
    file_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO files (id, original_name, mime_type, bytes_size)
        VALUES (:id, :name, :mime, :size)
    """), {"id": file_id, "name": file.filename, "mime": file.content_type, "size": len(pdf_bytes)})
    db.commit()

    pages_indexed = 0
    for page_no, png_bytes, w, h in rasterize_pdf(pdf_bytes, RENDER_DPI):
        # OpenAI features (full-res)
        feats = extract_features(png_bytes)
        # Embedding string
        emb_text = build_embed_text(feats)
        vec = embed(emb_text)

        colors = feats.get("colors") or {}
        chart  = feats.get("chart") or {}
        textf  = feats.get("text") or {}
        kf     = textf.get("key_fields") or {}

        db.execute(text("""
        INSERT INTO pages (
            file_id, page_number, width, height,
            caption, content_types, has_chart, chart_type, chart_topics,
            color_names, colors_hex, primary_background,
            text_summary, key_brand, key_product, key_variant, claims,
            metadata, embedding
        ) VALUES (
            :file_id, :page_number, :w, :h,
            :caption, :content_types, :has_chart, :chart_type, :chart_topics,
            :color_names, :colors_hex, :primary_background,
            :text_summary, :key_brand, :key_product, :key_variant, :claims,
            :metadata, :embedding
        )
        """),
        {
            "file_id": file_id,
            "page_number": page_no,
            "w": w, "h": h,
            "caption": feats.get("caption",""),
            "content_types": feats.get("content_types", []),
            "has_chart": bool(chart.get("has_chart", False)),
            "chart_type": chart.get("type") or "",
            "chart_topics": chart.get("topic_keywords", []),
            "color_names": colors.get("color_names", []),
            "colors_hex": colors.get("dominant_hex", []),
            "primary_background": colors.get("primary_background"),
            "text_summary": textf.get("summary",""),
            "key_brand": (kf.get("brand") or ""),
            "key_product": (kf.get("product") or ""),
            "key_variant": (kf.get("variant") or ""),
            "claims": (kf.get("claims") or []),
            "metadata": json.dumps(feats, ensure_ascii=False),
            "embedding": vec
        })
        pages_indexed += 1

    db.commit()
    return IngestResponse(file_id=file_id, pages_indexed=pages_indexed)
