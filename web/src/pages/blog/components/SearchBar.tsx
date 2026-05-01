import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  onSearch: (keyword: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [searchInput, setSearchInput] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch(searchInput.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索文章..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit">搜索</Button>
    </form>
  )
}