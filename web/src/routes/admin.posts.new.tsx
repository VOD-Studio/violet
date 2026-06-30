import { PostEditor } from "@features/posts/ui/PostEditor";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /admin/posts/new - 新建文章（全屏编辑器）
 *
 * 复用 PostEditor 组件，不传 postId 即新建模式。
 * 不套 PageShell，编辑器需全宽沉浸式布局。
 */
export const Route = createFileRoute("/admin/posts/new")({
    component: NewPostPage,
});

function NewPostPage() {
    return <PostEditor />;
}
