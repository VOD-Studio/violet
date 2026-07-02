import type { AdminPostListItem } from "@features/admin-posts/model/types";
import { PostEditor } from "@features/admin-posts/ui/PostEditor";
import { createFileRoute, useRouterState } from "@tanstack/react-router";

/**
 * /admin/posts/$id - 编辑文章（全屏编辑器）
 *
 * 复用 PostEditor 组件，传 postId 即编辑模式（useAdminPost 预填）。
 * 列表页跳转时可带 location state 作为骨架屏预填数据。
 */
export const Route = createFileRoute("/admin/posts/$id")({
    component: EditPostPage,
});

function EditPostPage() {
    const { id } = Route.useParams();
    const post = useRouterState({
        select: (s) => (s.location.state as { post?: AdminPostListItem } | undefined)?.post,
    });
    return <PostEditor postId={id} initialData={post} />;
}
