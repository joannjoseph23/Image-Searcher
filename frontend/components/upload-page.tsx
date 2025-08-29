"use client";

import { ImageIcon, Upload, X } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  preview?: string; // data URL of PDF first page
}

/** pdf.js lazy loader (client-only) */
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

export function UploadPage() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const allowedTypes = ["application/pdf"];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) return "Invalid file type. Only PDF is allowed.";
    if (file.size > maxFileSize) return "File size exceeds 10MB limit.";
    return null;
  };

  /** Render page 1 of the PDF to a small canvas and return a PNG data URL */
  const generatePdfThumbnail = async (file: File): Promise<string> => {
    const pdfjs = await getPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const desiredWidth = 160;
    const viewport = page.getViewport({ scale: 1 });
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);

    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;
    return canvas.toDataURL("image/png");
  };

  const createPreview = async (file: File): Promise<string> => generatePdfThumbnail(file);

  const handleFiles = useCallback(async (files: FileList) => {
    const newFiles: UploadFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);
      if (!error) {
        const preview = await createPreview(file);
        newFiles.push({
          id: Math.random().toString(36).slice(2, 11),
          file,
          progress: 0,
          status: "pending",
          preview,
        });
      }
    }
    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  /** ---- real upload to backend ---- */
  const uploadOne = async (fileRec: UploadFile) => {
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === fileRec.id ? { ...f, status: "uploading", progress: 5 } : f))
    );

    try {
      const form = new FormData();
      form.append("file", fileRec.file);

      // fetch doesn't expose upload progress; we fake a small ramp so users see movement
      const ramp = setInterval(() => {
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === fileRec.id && f.status === "uploading"
              ? { ...f, progress: Math.min(f.progress + 7, 85) }
              : f
          )
        );
      }, 150);

      const resp = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      clearInterval(ramp);

      if (!resp.ok) {
        const msg = await resp.text().catch(() => "Upload failed");
        throw new Error(msg);
      }

      // If your /upload already processes the PDF, you’re done.
      // If it only saves the file, this scan will ingest it.
      fetch(`${API_BASE}/ingest/scan`, { method: "POST" }).catch(() => {});

      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === fileRec.id ? { ...f, status: "completed", progress: 100 } : f
        )
      );
    } catch (e) {
      console.error(e);
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === fileRec.id ? { ...f, status: "error" } : f))
      );
    }
  };

  const uploadAll = () => {
    uploadFiles.forEach((f) => {
      if (f.status === "pending") uploadOne(f);
    });
  };

  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload PDFs</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Drag and drop your PDFs here</h3>
            <p className="text-muted-foreground mb-4">or click to browse files</p>
            <input
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-input"
            />
            <Button asChild>
              <label htmlFor="file-input" className="cursor-pointer">
                Choose Files
              </label>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">Supported: PDF (max 10MB each)</p>
          </div>
        </CardContent>
      </Card>

      {uploadFiles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Files ({uploadFiles.length})</CardTitle>
            <Button onClick={uploadAll} disabled={uploadFiles.every((f) => f.status !== "pending")}>
              Upload All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {f.preview ? (
                      <img src={f.preview} alt={f.file.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{f.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(f.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    {f.status === "uploading" && (
                      <div className="mt-2">
                        <Progress value={f.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round(f.progress)}% uploaded
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        f.status === "completed"
                          ? "default"
                          : f.status === "uploading"
                          ? "secondary"
                          : f.status === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {f.status}
                    </Badge>

                    {f.status === "pending" && (
                      <Button size="sm" onClick={() => uploadOne(f)}>
                        Upload
                      </Button>
                    )}

                    <Button size="sm" variant="ghost" onClick={() => removeFile(f.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
