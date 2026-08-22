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

			<header className="mx-auto max-w-400 px-4 pt-8 pb-7 sm:px-6 lg:px-8 lg:pt-10">
				<div className="flex items-center justify-between gap-4 border-b-2 border-[#11110f] pb-3">
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

				<div className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.55fr)] lg:items-end">
					<h1 className="max-w-220 text-[clamp(3.6rem,8vw,7rem)] leading-[0.83] font-black tracking-[-0.08em] text-balance">
						堇喵
						<span className="block text-(--mascot-accent)">动作室</span>
					</h1>

					<div className="pb-1">
						<p className="max-w-100 text-base leading-relaxed font-medium text-[#11110f]/70">
							选一个状态，给它一个动作，观察它如何回应你。角色、控制与结果始终在同一视线里。
						</p>
						<div className="mt-5 grid grid-cols-2 border-y-2 border-[#11110f]">
							<div className="py-3 pr-3">
								<p className="font-mono text-2xl font-black tabular-nums">
									{EMOTIONS.length}
								</p>
								<p className="mt-0.5 text-[10px] font-semibold text-[#11110f]/50">
									表情状态
								</p>
							</div>
							<div className="border-l-2 border-[#11110f] py-3 pl-3">
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
				</div>
			</header>

			<MascotLab />
		</div>
	);
}

export const Route = createFileRoute("/lab/mascot")({
	component: MascotLabPage,
});
