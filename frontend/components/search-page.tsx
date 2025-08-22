"use client"

import { Calendar, Filter, Grid, List, Palette, Search } from "lucide-react"
import { useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

// Mock data for demonstration
const mockImages = [
  { id: 1, name: "sunset-beach.jpg", size: "2.4 MB", date: "2024-01-15", type: "JPEG", dimensions: "1920x1080", tags: ["nature", "sunset", "beach"] },
  { id: 2, name: "mountain-landscape.png", size: "3.1 MB", date: "2024-01-14", type: "PNG", dimensions: "2560x1440", tags: ["nature", "mountain", "landscape"] },
  { id: 3, name: "city-night.jpg", size: "1.8 MB", date: "2024-01-13", type: "JPEG", dimensions: "1920x1080", tags: ["city", "night", "urban"] },
  { id: 4, name: "forest-path.webp", size: "2.7 MB", date: "2024-01-12", type: "WebP", dimensions: "1920x1280", tags: ["nature", "forest", "path"] },
]

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState("date")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const filteredImages = mockImages.filter((image) => {
    const matchesSearch =
      image.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(image.type)
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => image.tags.includes(tag))
    return matchesSearch && matchesType && matchesTags
  })

  const allTags = Array.from(new Set(mockImages.flatMap((img) => img.tags)))
  const COLOR_SWATCHES = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "gray"]

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
                {["JPEG", "PNG", "GIF", "WebP"].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedTypes([...selectedTypes, type])
                        else setSelectedTypes(selectedTypes.filter((t) => t !== type))
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

            {/* Image Size */}
            <div>
              <h4 className="font-medium mb-3">Image Size</h4>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (&lt; 1MB)</SelectItem>
                  <SelectItem value="medium">Medium (1-5MB)</SelectItem>
                  <SelectItem value="large">Large (&gt; 5MB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Orientation */}
            <div>
              <h4 className="font-medium mb-3">Orientation</h4>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Any orientation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
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
                        if (checked) setSelectedTags([...selectedTags, tag])
                        else setSelectedTags(selectedTags.filter((t) => t !== tag))
                      }}
                    />
                    <label htmlFor={tag} className="text-sm capitalize">
                      {tag}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Color Filters (fixed: no dynamic Tailwind classes) */}
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search images by name or tags..."
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
          <p className="text-muted-foreground">{filteredImages.length} results found</p>
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
                {filteredImages.map((image) => (
                  <div key={image.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-muted rounded mb-3 flex items-center justify-center">
                      <img
                        src={`/abstract-geometric-shapes.png?height=200&width=300&query=${image.name}`}
                        alt={image.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <h4 className="font-medium truncate">{image.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {image.dimensions} • {image.size}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {image.tags.map((tag) => (
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
                {filteredImages.map((image) => (
                  <div key={image.id} className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-muted rounded flex-shrink-0">
                      <img
                        src={`/abstract-geometric-shapes.png?height=64&width=64&query=${image.name}`}
                        alt={image.name}
                        className="w-full h-full object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{image.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {image.type} • {image.dimensions} • {image.size} • {image.date}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {image.tags.map((tag) => (
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
  )
}
