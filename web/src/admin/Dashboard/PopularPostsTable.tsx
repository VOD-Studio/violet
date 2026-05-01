// PopularPostsTable.tsx
// 热门文章排行表格组件

import { Link } from "react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface PopularPost {
  id: string
  title: string
  slug: string
  view_count: number
}

interface PopularPostsTableProps {
  posts: PopularPost[]
}

export function PopularPostsTable({ posts }: PopularPostsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>热门文章</CardTitle>
        <CardDescription>浏览量最高的文章排行</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">排名</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="text-right">浏览量</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  暂无热门文章数据
                </TableCell>
              </TableRow>
            ) : (
              posts.map((post, index) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <Badge
                      variant={index < 3 ? "default" : "secondary"}
                      className="w-7 justify-center"
                    >
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {post.view_count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}