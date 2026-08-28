import { useGalleryDetail } from "@features/galleries/api/queries";
import { GalleryDetailView } from "@features/galleries/ui/GalleryDetailView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import { PageShell } from "@/shared/ui/page-shell";

/** /galleries/$id - 图集详情（公开；removed 后端 404 → 错误态） */
export const Route = createFileRoute("/galleries/$id")({
	component: GalleryDetailPage,
});

function GalleryDetailPage() {
	const { id } = Route.useParams();
	const { data: gallery, isLoading, error } = useGalleryDetail(id);

	return (
		<PageShell>
			<header className="mb-6">
				<Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
					<Link to="/galleries" search={{ page: 1 }} aria-label="返回图集浏览流">
						<ArrowLeft className="size-4" />
						返回
					</Link>
				</Button>
			</header>

			{isLoading ? (
				<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
					加载中…
				</div>
			) : error || !gallery ? (
				// removed 图集后端 404，与不存在同一错误态
				<div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
					<p>图集不存在或已下架</p>
					<Button variant="outline" size="sm" asChild>
						<Link to="/galleries" search={{ page: 1 }}>
							回到图集
						</Link>
					</Button>
				</div>
			) : (
				<GalleryDetailView key={gallery.id} gallery={gallery} />
			)}
		</PageShell>
	);
}
