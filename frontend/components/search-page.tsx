"use client";

import { Calendar, Filter, Grid, List, Palette, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

/** ---------- pdf.js lazy loader (same idea as your Upload page) ---------- */
let pdfjsPromise: Promise<typeof import("pdfjs-dist/build/pdf")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist/build/pdf");
  const pdfjs = await pdfjsPromise;
  (pdfjs as any).GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return pdfjs as unknown as {
    getDocument: (args: any) => { promise: Promise<any> };
    GlobalWorkerOptions: { workerSrc: string };
  };
}

function PdfThumbnail({
  url,
  width = 300,
  className = "",
}: { url: string; width?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const res = await fetch(url, { cache: "force-cache" });
        const data = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaled = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);
        await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
        if (mounted) setSrc(canvas.toDataURL("image/png"));
      } catch {
        if (mounted) setSrc(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url, width]);

  return (
    <div className={`aspect-video bg-muted rounded mb-3 flex items-center justify-center overflow-hidden ${className}`}>
      {src ? <img src={src} alt="PDF preview" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
    </div>
  );
}

/** ---------- Types from backend /search ---------- */
type ApiRow = {
  id: string;
  pdf_filename: string;
  page_number: number;
  caption: string | null;
  keywords: string[] | null;
  pdf_path: string; // e.g. "/samples/foo.pdf"
  score: number;
};
type Item = {
  id: string;
  name: string;
  type: "PDF";
  url: string;
  pages?: number;
  tags: string[];
};

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("date"); // cosmetic for now
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const allTags = Array.from(new Set(items.flatMap((i) => i.tags)));

  async function runSearch(q: string) {
    const base = process.env.NEXT_PUBLIC_API_BASE!;
    if (!q.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${base}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = (await r.json()) as { ok: boolean; results: ApiRow[] };
      if (!data.ok) throw new Error("Search failed");
      const mapped: Item[] = data.results.map((row) => ({
        id: row.id,
        name: row.pdf_filename,
        type: "PDF",
        url: row.pdf_path,
        pages: 1,
        tags: row.keywords ?? [],
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = items.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q || doc.name.toLowerCase().includes(q) || doc.tags.some((t) => t.toLowerCase().includes(q));
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(doc.type);
    const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => doc.tags.includes(t));
    return matchesSearch && matchesType && matchesTags;
  });

  const COLOR_SWATCHES = ["red","blue","green","yellow","purple","orange","pink","gray"];

  return (
    <div className="flex gap-6">
      {/* Filters Sidebar */}
      <div className="w-80 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">File Type</h4>
              <div className="space-y-2">
                {["PDF"].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedTypes([...selectedTypes, type]);
                        else setSelectedTypes(selectedTypes.filter((t) => t !== type));
                      }}
                    />
                    <label htmlFor={type} className="text-sm">{type}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </h4>
              <div className="space-y-2">
                <Input type="date" placeholder="From" />
                <Input type="date" placeholder="To" />
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Tags</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {allTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={tag}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedTags([...selectedTags, tag]);
                        else setSelectedTags(selectedTags.filter((t) => t !== tag));
                      }}
                    />
                    <label htmlFor={tag} className="text-sm capitalize">{tag}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Dominant Colors
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_SWATCHES.map((color) => (
                  <div
                    key={color}
                    className="w-8 h-8 rounded cursor-pointer border-2 border-transparent hover:border-primary"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search PDFs by name or tags…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runSearch(searchQuery); }}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => runSearch(searchQuery)} disabled={loading}>
                {loading ? "Searching…" : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} results`}
          </p>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="size">Sort by Size</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><Grid className="h-4 w-4" /></Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <PdfThumbnail url={doc.url} />
                    <h4 className="font-medium truncate">{doc.name}</h4>
                    <p className="text-sm text-muted-foreground">PDF • 1 page</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="w-16 flex-shrink-0">
                      <PdfThumbnail url={doc.url} width={64} className="mb-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{doc.name}</h4>
                      <p className="text-sm text-muted-foreground">PDF • 1 page</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
