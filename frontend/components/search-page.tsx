"use client";

import { Calendar, Filter, Grid, List, Palette, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";

/** ---------- pdf.js lazy loader ---------- */
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

function PdfThumbnail({ url, width = 300, className = "" }: { url: string; width?: number; className?: string }) {
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

type Item = {
  id: string;
  pdf_filename: string;
  page_number: number;
  caption: string | null;
  keywords: string[] | null;
  pdf_path: string; // e.g. /samples/foo.pdf
};

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("date");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // load recent items on mount
  useEffect(() => {
  (async () => {
    try {
      const r = await fetch(`${API_BASE}/items`);
      const j = await r.json();
      if (j.ok) setItems(j.items);   // <-- was j.results
    } catch (e) {
      console.error("Failed to load items", e);
    }
  })();
}, []);

  const runSearch = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery }),
      });
      const j = await r.json();
      if (j.ok) setItems(j.results);
    } catch (e) {
      console.error("search failed", e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    // you can still layer client filters if you want
    let out = [...items];
    if (selectedTypes.length) {
      // currently only PDF anyway
      out = out.filter(() => true);
    }
    if (selectedTags.length) {
      out = out.filter((doc) => {
        const tags = (doc.keywords ?? []).map((t) => t.toLowerCase());
        return selectedTags.some((t) => tags.includes(t.toLowerCase()));
      });
    }
    // simple client sort switch (we don't have size/date in DB yet)
    if (sortBy === "name") out.sort((a, b) => a.pdf_filename.localeCompare(b.pdf_filename));
    return out;
  }, [items, selectedTypes, selectedTags, sortBy]);

  const allTags = Array.from(
    new Set(items.flatMap((i) => (i.keywords ?? []).map((t) => t.toLowerCase())))
  );
  const COLOR_SWATCHES = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "gray"];

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
                    <label htmlFor={type} className="text-sm">
                      {type}
                    </label>
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
                    <label htmlFor={tag} className="text-sm capitalize">
                      {tag}
                    </label>
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
                  <div key={color} className="w-8 h-8 rounded border-2 border-transparent hover:border-primary" style={{ backgroundColor: color }} />
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
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
              </div>
              <Button onClick={runSearch} disabled={loading}>Search</Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{filtered.length} results</p>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
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
                    <PdfThumbnail url={doc.pdf_path} />
                    <h4 className="font-medium truncate">{doc.pdf_filename}</h4>
                    <p className="text-sm text-muted-foreground">
                      PDF • page {doc.page_number}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(doc.keywords ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
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
                      <PdfThumbnail url={doc.pdf_path} width={64} className="mb-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{doc.pdf_filename}</h4>
                      <p className="text-sm text-muted-foreground">PDF • page {doc.page_number}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(doc.keywords ?? []).map((tag) => (
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
