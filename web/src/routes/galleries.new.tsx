import { requireGalleryAuth } from "@features/galleries/lib/require-gallery-auth";
import { GalleryComposer } from "@features/galleries/ui/GalleryComposer";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/shared/ui/page-shell";

/** /galleries/new - 新建图集（PRD-0022 T2，需登录） */
export const Route = createFileRoute("/galleries/new")({
	ssr: false,
	beforeLoad: ({ location }) => requireGalleryAuth(location),
	component: NewGalleryPage,
});

function NewGalleryPage() {
	return (
		<PageShell>
			<header className="mb-8">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Galleries
				</p>
				<h1 className="font-mono text-4xl font-bold">新建图集</h1>
			</header>
			<GalleryComposer mode="create" />
		</PageShell>
	);
}
