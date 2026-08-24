import { MascotLab } from "@features/lab/mascot/ui/MascotLab";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EMOTIONS } from "@violet/mascot";
import { ArrowLeft } from "lucide-react";

function MascotLabPage() {
	return (
		<div className="min-h-dvh bg-background text-foreground selection:bg-neon-blue selection:text-black">
			<header className="container mx-auto max-w-360 px-4 pt-5 pb-4 sm:px-6 lg:px-8">
				<div className="flex min-h-14 flex-wrap items-center justify-between gap-4 border-b border-edge-hairline pb-4">
					<div className="flex min-w-0 items-center gap-4">
						<Link
							to="/lab"
							className="inline-flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-neon-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
						>
							<ArrowLeft className="size-3.5" />
							<span className="hidden sm:inline">Design lab</span>
						</Link>
						<span aria-hidden className="h-7 w-px bg-edge-hairline" />
						<div className="min-w-0">
							<p className="font-mono text-[9px] tracking-[0.24em] text-muted-foreground uppercase">
								Mascot / SVG engine
							</p>
							<h1 className="mt-1 truncate text-lg font-semibold tracking-tight">
								吉祥物形象实验室
							</h1>
						</div>
					</div>

					<div className="flex items-center divide-x divide-edge-hairline font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
						<span className="pr-3">
							{String(EMOTIONS.length).padStart(2, "0")} states
						</span>
						<span className="flex items-center gap-2 pl-3">
							<span aria-hidden className="size-1.5 bg-neon-blue" />
							Live render
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
