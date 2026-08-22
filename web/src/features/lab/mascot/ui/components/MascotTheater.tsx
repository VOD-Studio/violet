import type { EmotionDef } from "@violet/mascot";
import { resolveEmotionId } from "@violet/mascot";
import type { MascotHandle } from "@violet/mascot/react";
import { MascotStage } from "@violet/mascot/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { GROUP_LABEL } from "../hooks/useMascotExhibit";
import { MascotDirectorPanel } from "./MascotDirectorPanel";

interface EmotionBubbleProps {
	text: string;
	gen: number;
}

/** 当前台词，固定在角色斜上方并随新消息重新入场。 */
function EmotionBubble({ text, gen }: EmotionBubbleProps) {
	return (
		<div
			key={gen}
			className="absolute top-[18%] right-[17%] z-30 w-40 animate-[mascot-bubble_4.5s_ease-in-out_forwards] rounded-lg border border-[#8c765f]/55 bg-[#fff9ec] px-3 py-2 text-left text-[11px] leading-snug font-semibold text-[#352820] shadow-[0_10px_28px_rgba(16,10,8,0.34)] motion-reduce:animate-none sm:w-48"
		>
			<span
				aria-hidden
				className="absolute -bottom-1.5 left-5 size-3 rotate-45 border-r border-b border-[#8c765f]/55 bg-[#fff9ec]"
			/>
			{text}
		</div>
	);
}

/** 主舞台接收当前状态，并把播放与 AI 消息事件回传给展馆状态机。 */
export interface MascotTheaterProps {
	def: EmotionDef;
	bubble: EmotionBubbleProps;
	isTouring: boolean;
	onToggleTour: () => void;
	onReplay: () => void;
	onAIMessage: (emotionId: string, tips?: string) => void;
}

/** 角色舞台与导演控制台，所有高频操作始终围绕角色排布。 */
export function MascotTheater({
	def,
	bubble,
	isTouring,
	onToggleTour,
	onReplay,
	onAIMessage,
}: MascotTheaterProps) {
	const mascotRef = useRef<MascotHandle>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const agentMessage = useAgentStatus();
	const agentEmotion = agentMessage ? resolveEmotionId(agentMessage) : null;

	const handleStageMove = (event: ReactPointerEvent) => {
		const rect = stageRef.current?.getBoundingClientRect();
		if (!rect) return;
		const gazeX = Math.max(
			-1,
			Math.min(1, ((event.clientX - rect.left - rect.width / 2) / rect.width) * 2.4),
		);
		const gazeY = Math.max(
			-1,
			Math.min(1, ((event.clientY - rect.top - rect.height / 2) / rect.height) * 2.4),
		);
		mascotRef.current?.setGaze(gazeX, gazeY);
	};

	const replay = () => {
		mascotRef.current?.setEmotion(def.id);
		onReplay();
	};

	return (
		<div className="order-1 grid min-w-0 gap-4 lg:order-2 lg:grid-cols-[minmax(0,1fr)_17rem]">
			<section className="flex min-w-0 flex-col border-2 border-[#11110f] bg-[#f8f9f5] lg:h-147">
				<header className="flex h-17 shrink-0 items-center justify-between gap-3 border-b-2 border-[#11110f] px-3 sm:px-4">
					<div className="flex min-w-0 items-center gap-2.5">
						<span aria-hidden className="size-2 shrink-0 bg-(--mascot-accent)" />
						<div className="min-w-0">
							<div className="flex items-baseline gap-2">
								<h2
									data-stage-emotion={def.id}
									className="truncate text-lg font-black tracking-[-0.04em] sm:text-xl"
								>
									{def.name}
								</h2>
								<span className="shrink-0 font-mono text-[9px] text-[#11110f]/45">
									{def.id} / {def.en}
								</span>
							</div>
							<p className="mt-0.5 truncate text-[10px] text-[#11110f]/55">
								{def.desc}
							</p>
						</div>
					</div>

					<div className="flex shrink-0 border border-[#11110f] bg-white">
						<button
							type="button"
							onClick={replay}
							className="inline-flex h-8 cursor-pointer items-center gap-1.5 px-2.5 text-[10px] font-bold transition-colors hover:bg-[#eceee9] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent) focus-visible:ring-inset"
							title="重播当前表情动画与对白"
						>
							<RotateCcw className="size-3" />
							重播
						</button>
						<button
							type="button"
							onClick={onToggleTour}
							aria-pressed={isTouring}
							className={cn(
								"inline-flex h-8 cursor-pointer items-center gap-1.5 border-l border-[#11110f] px-2.5 text-[10px] font-bold transition-[background-color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent) focus-visible:ring-inset",
								isTouring
									? "bg-[#e9e5de] shadow-[inset_0_-2px_0_var(--mascot-accent)]"
									: "hover:bg-[#eceee9]",
							)}
							title={isTouring ? "暂停自动巡演" : "开始自动巡演"}
						>
							{isTouring ? <Pause className="size-3" /> : <Play className="size-3" />}
							巡演
						</button>
					</div>
				</header>

				<div
					ref={stageRef}
					onPointerMove={handleStageMove}
					onPointerLeave={() => mascotRef.current?.setGaze(0, 0)}
					className="mascot-stage-scene relative h-104 min-h-0 overflow-hidden sm:h-120 lg:h-auto lg:flex-1"
				>
					<div aria-hidden className="mascot-stage-ambient" />
					<div aria-hidden className="mascot-stage-floor-light" />
					<div aria-hidden className="mascot-stage-sidewash mascot-stage-sidewash-left" />
					<div
						aria-hidden
						className="mascot-stage-sidewash mascot-stage-sidewash-right"
					/>
					<div aria-hidden className="mascot-stage-beam" />
					<div aria-hidden className="mascot-stage-source" />
					<div aria-hidden className="mascot-stage-pool" />
					<div aria-hidden className="mascot-stage-edge" />
					<div aria-hidden className="mascot-stage-vignette" />

					<p className="mascot-stage-hud">
						{GROUP_LABEL[def.group]}
						<span aria-hidden>·</span>#{def.id}
						{agentMessage && (
							<>
								<span aria-hidden>·</span>
								<span data-agent-state={agentMessage.state}>
									{agentMessage.agent} {agentMessage.state}
								</span>
							</>
						)}
						<span aria-hidden className="mascot-stage-live-dot" />
					</p>

					<MascotStage
						ref={mascotRef}
						emotion={agentEmotion ?? def.id}
						onClick={() => mascotRef.current?.bounce()}
						className="mascot-stage-character"
					/>
					<EmotionBubble text={bubble.text} gen={bubble.gen} />
				</div>

				<footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t-2 border-[#11110f] px-3 text-[9px] text-[#11110f]/55 sm:px-4">
					<p>移动指针控制视线，点击角色让它弹跳</p>
					<p className="hidden font-mono sm:block">Live SVG renderer</p>
				</footer>
			</section>

			<MascotDirectorPanel mascotRef={mascotRef} def={def} onAIMessage={onAIMessage} />
		</div>
	);
}
