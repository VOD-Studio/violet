// 文章错误状态组件

import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArticleErrorProps {
  /** 错误信息 */
  error?: unknown;
}

/**
 * 文章错误或不存在状态
 */
export function ArticleError({ error }: ArticleErrorProps) {
  return (
    <div className="container mx-auto px-4 py-12">
      <Link to="/blog">
        <Button variant="ghost" className="mb-6 gap-1">
          <ArrowLeft className="size-4" />
          返回文章列表
        </Button>
      </Link>
      <div className="py-12 text-center text-muted-foreground">
        {error ? String(error) : "文章不存在"}
      </div>
    </div>
  );
}
