import { PostEditor } from "@features/admin-posts/ui/PostEditor";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /admin/posts/$id - 编辑文章（全屏编辑器）
 *
 * 复用 PostEditor 组件，传 postId 即编辑模式（useAdminPost 预填）。
 */
export const Route = createFileRoute("/admin/posts/$id")({
    component: EditPostPage,
});

function EditPostPage() {
    const { id } = Route.useParams();
    return <PostEditor postId={id} />;
}
