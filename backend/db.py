# backend/db.py
import os
from dotenv import load_dotenv
from contextlib import contextmanager
from typing import Optional, List

from sqlalchemy import (
    create_engine, text, Column, String, Integer, BigInteger,
    TIMESTAMP, JSON, Text
)
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

load_dotenv()  # load backend/.env

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

# engine + session
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

class ImagePage(Base):
    """
    One row per PDF page processed.
    """
    __tablename__ = "image_pages"

    id = Column(String, primary_key=True)  # "<sha256>-p<page>"
    pdf_filename = Column(String, index=True, nullable=False)
    pdf_path = Column(Text, nullable=False)           # e.g., /samples/flower.pdf
    page_number = Column(Integer, nullable=False)     # 1-based
    width = Column(Integer)
    height = Column(Integer)
    size_bytes = Column(BigInteger)

    caption = Column(Text)         # short text
    keywords = Column(JSON)        # list[str]
    raw_metadata = Column(JSON)    # full JSON from OpenAI

    embedding = Column(Vector(3072))  # text-embedding-3-large

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

def init_db():
    # ensure pgvector extension and create tables
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)

@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def upsert_image_page(
    session,
    *,
    id: str,
    pdf_filename: str,
    pdf_path: str,
    page_number: int,
    width: int,
    height: int,
    size_bytes: int,
    caption: Optional[str],
    keywords: Optional[List[str]],
    raw_metadata: Optional[dict],
    embedding: Optional[list[float]],
):
    """
    Insert if missing; otherwise update the existing row by id.
    """
    row = session.get(ImagePage, id)
    if row is None:
        row = ImagePage(
            id=id,
            pdf_filename=pdf_filename,
            pdf_path=pdf_path,
            page_number=page_number,
            width=width,
            height=height,
            size_bytes=size_bytes,
            caption=caption,
            keywords=keywords,
            raw_metadata=raw_metadata,
            embedding=embedding,
        )
        session.add(row)
    else:
        row.pdf_filename = pdf_filename
        row.pdf_path = pdf_path
        row.page_number = page_number
        row.width = width
        row.height = height
        row.size_bytes = size_bytes
        row.caption = caption
        row.keywords = keywords
        row.raw_metadata = raw_metadata
        row.embedding = embedding
    return row
