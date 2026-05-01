import { usePosts } from "@/hooks/usePosts"
import { PostCard } from "@/components/blog/PostCard"

interface PostGridProps {
  page: number
  tag?: string
  search?: string
}

export function PostGrid({ page, tag, search }: PostGridProps) {
  const { data, isLoading, error } = usePosts({
    page,
    limit: 6,
    tag,
    search,
  })

  const posts = data?.posts ?? []

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg border bg-muted"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {String(error)}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        暂无文章
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} delay={index * 0.05} />
      ))}
    </div>
  )
}