import type { AdminPostListItem } from "@features/admin-posts/model/types";
import { PostEditor } from "@features/admin-posts/ui/PostEditor";
import { createFileRoute, useRouterState } from "@tanstack/react-router";

/**
 * /admin/posts/$id - 编辑文章（全屏编辑器）
 *
 * 复用 PostEditor 组件，传 postId 即编辑模式（useAdminPost 预填）。
 * 列表页跳转时可带 location state 作为骨架屏预填数据。
 * 不套 PageShell；内边距由本路由自带（同 admin.posts.new），h-full 保持高度链。
 */
export const Route = createFileRoute("/admin/posts/$id")({
    component: EditPostPage,
});

function EditPostPage() {
    const { id } = Route.useParams();
    const post = useRouterState({
        select: (s) => (s.location.state as { post?: AdminPostListItem } | undefined)?.post,
    });
    return (
        <div className="h-full px-4 pt-4 pb-6 md:px-6">
            <PostEditor postId={id} initialData={post} />
        </div>
    );
}
