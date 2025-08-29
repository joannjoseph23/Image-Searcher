import { NextResponse } from "next/server";

const API_URL = process.env.BACKEND_URL || "http://localhost:8001";

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const r = await fetch(`${API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
  });

  const data = await r.json();

  const results = (data.results || []).map((row: any) => ({
    id: row.id,
    caption: row.caption || row.pdf_filename,
    keywords: row.keywords || [],
    pdf_path: row.pdf_path,
    page_number: row.page_number,
  }));

  return NextResponse.json({ ok: true, results });
}
