import { MascotLab } from "@features/lab/mascot/ui/MascotLab";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EMOTIONS } from "@violet/mascot";
import { ArrowLeft } from "lucide-react";

function MascotLabPage() {
	return (
		<div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#e7eae5] text-[#11110f] [--mascot-accent:#c14b38]">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(17,17,15,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,15,0.045)_1px,transparent_1px)] bg-size-[24px_24px]"
			/>

			<header className="mx-auto max-w-400 px-4 pt-8 pb-6 sm:px-6 lg:px-8 lg:pt-10">
				<div className="flex items-center justify-between gap-4 border-b border-[#11110f]/25 pb-4">
					<Link
						to="/lab"
						className="inline-flex items-center gap-2 text-xs font-bold transition-transform hover:-translate-x-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--mascot-accent)"
					>
						<ArrowLeft className="size-3.5" />
						返回实验室
					</Link>
					<p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#11110f]/55">
						Character direction room
					</p>
				</div>

				<div className="flex flex-wrap items-end justify-between gap-6 pt-8">
					<div>
						<p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#11110f]/50">
							Mascot / SVG interaction engine
						</p>
						<h1 className="mt-2 max-w-220 text-[clamp(2.75rem,6vw,5.5rem)] leading-none font-black tracking-[-0.08em] text-balance">
							吉祥物形象实验室
						</h1>
					</div>

					<div className="flex items-end gap-6 pb-1">
						<div className="border-l-2 border-(--mascot-accent) pl-3">
							<p className="font-mono text-3xl font-black tabular-nums">
								{EMOTIONS.length}
							</p>
							<p className="mt-0.5 text-[10px] font-semibold text-[#11110f]/50">
								表情状态
							</p>
						</div>
						<div>
							<p className="flex items-center gap-2 text-sm font-black">
								<span aria-hidden className="size-2 bg-(--mascot-accent)" />
								实时渲染
							</p>
							<p className="mt-1 font-mono text-[9px] text-[#11110f]/50">
								SVG interaction engine
							</p>
						</div>
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
