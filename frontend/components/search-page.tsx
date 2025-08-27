"use client";

import { Calendar, Filter, Grid, List, Palette, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
      } catch (e) {
        // Fallback: show a neutral block if render fails
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

/** ---------------- mock data now uses PDFs ---------------- */
type Item = {
  id: number;
  name: string;
  size: string;
  date: string;
  type: "PDF";
  pages: number;
  tags: string[];
  url: string; // public or dev server URL to the PDF
};

const mockItems: Item[] = [
  {
    id: 1,
    name: "doritos (1).pdf",
    size: "2.1 MB",
    date: "2025-08-20",
    type: "PDF",
    pages: 1,
    tags: ["chips", "snack", "packaging"],
    url: "/samples/doritos%20(1).pdf",
  },
  {
    id: 2,
    name: "flower.pdf",
    size: "1.7 MB",
    date: "2025-08-19",
    type: "PDF",
    pages: 1,
    tags: ["flower", "nature"],
    url: "/samples/flower.pdf",
  },
  {
    id: 3,
    name: "knorr.pdf",
    size: "2.3 MB",
    date: "2025-08-18",
    type: "PDF",
    pages: 1,
    tags: ["knorr", "packaging", "food"],
    url: "/samples/knorr.pdf",
  },
  {
    id: 4,
    name: "pancake.pdf",
    size: "1.9 MB",
    date: "2025-08-18",
    type: "PDF",
    pages: 1,
    tags: ["pancake", "menu"],
    url: "/samples/pancake.pdf",
  },
  {
    id: 5,
    name: "panda.pdf",
    size: "2.0 MB",
    date: "2025-08-17",
    type: "PDF",
    pages: 1,
    tags: ["panda", "animal"],
    url: "/samples/panda.pdf",
  },
  {
    id: 6,
    name: "sign.pdf",
    size: "1.2 MB",
    date: "2025-08-17",
    type: "PDF",
    pages: 1,
    tags: ["sign", "poster"],
    url: "/samples/sign.pdf",
  },
];


export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("date");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const items = useMemo(() => {
    // apply sort
    const sorted = [...mockItems].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "size") return parseFloat(a.size) - parseFloat(b.size);
      return b.date.localeCompare(a.date);
    });
    return sorted;
  }, [sortBy]);

  const filtered = items.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = doc.name.toLowerCase().includes(q) || doc.tags.some((t) => t.toLowerCase().includes(q));
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(doc.type);
    const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => doc.tags.includes(t));
    return matchesSearch && matchesType && matchesTags;
  });

  const allTags = Array.from(new Set(mockItems.flatMap((i) => i.tags)));
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
            {/* File Type Filter */}
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

            {/* Date Range */}
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

            {/* Size, Orientation (keep as-is visually) */}
            <div>
              <h4 className="font-medium mb-3">File Size</h4>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (&lt; 1MB)</SelectItem>
                  <SelectItem value="medium">Medium (1–5MB)</SelectItem>
                  <SelectItem value="large">Large (&gt; 5MB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
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

            {/* Color filters – keeping your UI element */}
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
        {/* Search Bar */}
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
                />
              </div>
              <Button>Search</Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{filtered.length} results found</p>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="size">Sort by Size</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
                <Grid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <Card>
          <CardContent className="pt-6">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <PdfThumbnail url={doc.url} />
                    <h4 className="font-medium truncate">{doc.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {doc.type} • {doc.pages} pages • {doc.size}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.tags.map((tag) => (
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
                      <PdfThumbnail url={doc.url} width={64} className="mb-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{doc.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {doc.type} • {doc.pages} pages • {doc.size} • {doc.date}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
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
