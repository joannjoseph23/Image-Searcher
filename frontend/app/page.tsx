"use client"

import { Search, Upload } from "lucide-react"
import { useState } from "react"
import { SearchPage } from "../components/search-page"
import { Button } from "../components/ui/button"
import { UploadPage } from "../components/upload-page"

export default function Home() {
  const [currentPage, setCurrentPage] = useState<"upload" | "search">("upload")

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">Image Management System</h1>
            <nav className="flex gap-2">
              <Button
                variant={currentPage === "upload" ? "default" : "outline"}
                onClick={() => setCurrentPage("upload")}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              <Button
                variant={currentPage === "search" ? "default" : "outline"}
                onClick={() => setCurrentPage("search")}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">{currentPage === "upload" ? <UploadPage /> : <SearchPage />}</main>
    </div>
  )
}
