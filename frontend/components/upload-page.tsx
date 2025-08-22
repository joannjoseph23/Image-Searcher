"use client"

import type React from "react"

import { ImageIcon, Upload, X } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Progress } from "./ui/progress"

interface UploadFile {
  id: string
  file: File
  progress: number
  status: "pending" | "uploading" | "completed" | "error"
  preview?: string
}

export function UploadPage() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const allowedTypes = ["application/pdf"];
  const maxFileSize = 10 * 1024 * 1024 // 10MB

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
    }
    if (file.size > maxFileSize) {
      return "File size exceeds 10MB limit."
    }
    return null
  }

  const createPreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }

  const handleFiles = useCallback(async (files: FileList) => {
    const newFiles: UploadFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const error = validateFile(file)

      if (!error) {
        const preview = await createPreview(file)
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          progress: 0,
          status: "pending",
          preview,
        })
      }
    }

    setUploadFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles],
  )

  const simulateUpload = (fileId: string) => {
    setUploadFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "uploading" as const } : f)))

    const interval = setInterval(() => {
      setUploadFiles((prev) =>
        prev.map((f) => {
          if (f.id === fileId && f.status === "uploading") {
            const newProgress = Math.min(f.progress + Math.random() * 20, 100)
            if (newProgress >= 100) {
              clearInterval(interval)
              return { ...f, progress: 100, status: "completed" as const }
            }
            return { ...f, progress: newProgress }
          }
          return f
        }),
      )
    }, 200)
  }

  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const uploadAll = () => {
    uploadFiles.forEach((file) => {
      if (file.status === "pending") {
        simulateUpload(file.id)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Drag and drop your images here</h3>
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
            <p className="text-sm text-muted-foreground mt-4">
              Supported formats: JPEG, PNG, GIF, WebP (max 10MB each)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
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
              {uploadFiles.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {uploadFile.preview ? (
                      <img
                        src={uploadFile.preview || "/placeholder.svg"}
                        alt={uploadFile.file.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    {/* Progress */}
                    {uploadFile.status === "uploading" && (
                      <div className="mt-2">
                        <Progress value={uploadFile.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round(uploadFile.progress)}% uploaded
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        uploadFile.status === "completed"
                          ? "default"
                          : uploadFile.status === "uploading"
                            ? "secondary"
                            : uploadFile.status === "error"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {uploadFile.status}
                    </Badge>

                    {uploadFile.status === "pending" && (
                      <Button size="sm" onClick={() => simulateUpload(uploadFile.id)}>
                        Upload
                      </Button>
                    )}

                    <Button size="sm" variant="ghost" onClick={() => removeFile(uploadFile.id)}>
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
  )
}
