import { MascotLab } from "@features/lab/mascot/ui/MascotLab";
import { BackLink } from "@shared/ui/back-link";
import { createFileRoute } from "@tanstack/react-router";
import { EMOTIONS } from "@violet/mascot";

function MascotLabPage() {
	return (
		<div className="min-h-dvh bg-background text-foreground selection:bg-neon-blue selection:text-black">
			<header className="container mx-auto max-w-360 px-4 pt-5 pb-4 sm:px-6 lg:px-8">
				<div className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-edge-hairline pb-4">
					<div className="flex min-w-0 items-center gap-4">
						<BackLink to="/lab" label="返回实验室" className="-ml-3 sm:ml-0" />
						<span aria-hidden className="h-7 w-px bg-edge-hairline" />
						<div className="min-w-0">
							<p className="font-mono text-[9px] tracking-[0.24em] text-muted-foreground uppercase">
								Mascot / SVG 引擎
							</p>
							<h1 className="mt-1 truncate text-lg font-semibold tracking-tight">
								吉祥物形象实验室
							</h1>
						</div>
					</div>

					<div className="flex items-center divide-x divide-edge-hairline font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
						<span className="pr-3">
							{String(EMOTIONS.length).padStart(2, "0")} 套状态
						</span>
						<span className="flex items-center gap-2 pl-3">
							<span aria-hidden className="size-1.5 bg-neon-blue" />
							实时渲染
						</span>
					</div>
				</div>
			</header>

			<MascotLab />
		</div>
	);
}

export const Route = createFileRoute("/lab/mascot")({
	component: MascotLabPage,
});
