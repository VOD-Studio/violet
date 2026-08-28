import { useMe } from "@features/auth/api/queries";
import { useGalleryDetail } from "@features/galleries/api/queries";
import { requireGalleryAuth } from "@features/galleries/lib/require-gallery-auth";
import { GalleryComposer } from "@features/galleries/ui/GalleryComposer";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import { PageShell } from "@/shared/ui/page-shell";

/**
 * /galleries/$id/edit - 编辑图集（owner，URL 保持不变：items 全量替换）
 *
 * 详情公开可读，非 owner 也能打开本页，但保存时后端 403；
 * 页面比对 me.id 提前给出无权限提示，减少无效编辑。
 */
export const Route = createFileRoute("/galleries/$id/edit")({
	ssr: false,
	beforeLoad: ({ location }) => requireGalleryAuth(location),
	component: EditGalleryPage,
});

function EditGalleryPage() {
	const { id } = Route.useParams();
	const { data: me, isLoading: meLoading } = useMe();
	const { data: gallery, isLoading, error } = useGalleryDetail(id);

	return (
		<PageShell>
			<header className="mb-8">
				<Button
					variant="ghost"
					size="sm"
					className="mb-4 -ml-2 text-muted-foreground"
					onClick={() => history.back()}
				>
					<ArrowLeft className="size-4" />
					返回
				</Button>
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Galleries
				</p>
				<h1 className="font-mono text-4xl font-bold">编辑图集</h1>
			</header>

			{isLoading || meLoading ? (
				<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
					加载中…
				</div>
			) : error ? (
				<div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
					<p>图集不存在或已下架</p>
				</div>
			) : gallery && me && me.id !== gallery.author.id ? (
				<div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
					<p>只有图集作者可以编辑</p>
				</div>
			) : gallery ? (
				<GalleryComposer key={gallery.id} mode="edit" gallery={gallery} />
			) : null}
		</PageShell>
	);
}
