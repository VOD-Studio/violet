import { PostEditor } from "@features/admin-posts/ui/PostEditor";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /admin/posts/new - 新建文章（全屏编辑器）
 *
 * 复用 PostEditor 组件，不传 postId 即新建模式。
 * 不套 PageShell，编辑器需全宽沉浸式布局；内边距由本路由自带
 * （PageShell 正常路径同款 px-4 md:px-6），h-full 保持编辑器高度链。
 */
export const Route = createFileRoute("/admin/posts/new")({
    component: NewPostPage,
});

function NewPostPage() {
    return (
        <div className="h-full px-4 pt-4 pb-6 md:px-6">
            <PostEditor />
        </div>
    );
}
