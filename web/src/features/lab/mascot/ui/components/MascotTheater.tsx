import type { EmotionDef } from "@violet/mascot";
import { resolveEmotionId } from "@violet/mascot";
import type { MascotHandle } from "@violet/mascot/react";
import { MascotStage } from "@violet/mascot/react";
import { Grid2X2, Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Segmented, type SegmentedItem } from "@/shared/ui/segmented";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { GROUP_LABEL, type MascotGroupFilter } from "../hooks/useMascotExhibit";
import { MascotDirectorPanel } from "./MascotDirectorPanel";
import { MascotEmotionLibrary } from "./MascotEmotionLibrary";

type DockView = "states" | "controls";

const DOCK_SEGMENTS: SegmentedItem<DockView>[] = [
	{
		value: "states",
		label: (
			<>
				<Grid2X2 className="size-3" />
				状态
			</>
		),
	},
	{
		value: "controls",
		label: (
			<>
				<SlidersHorizontal className="size-3" />
				控制
			</>
		),
	},
];

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

/** 主舞台接收当前状态，并把播放、选择与 AI 消息事件回传给展馆状态机。 */
export interface MascotTheaterProps {
	def: EmotionDef;
	bubble: EmotionBubbleProps;
	group: MascotGroupFilter;
	groupList: EmotionDef[];
	activeId: string;
	isTouring: boolean;
	onSelectGroup: (group: MascotGroupFilter) => void;
	onSelectEmotion: (id: string) => void;
	onToggleTour: () => void;
	onReplay: () => void;
	onAIMessage: (emotionId: string, tips?: string) => void;
}

/** 角色舞台与 Studio Dock，让状态切换和演出控制始终靠近舞台。 */
export function MascotTheater({
	def,
	bubble,
	group,
	groupList,
	activeId,
	isTouring,
	onSelectGroup,
	onSelectEmotion,
	onToggleTour,
	onReplay,
	onAIMessage,
}: MascotTheaterProps) {
	const mascotRef = useRef<MascotHandle>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const [dockView, setDockView] = useState<DockView>("states");
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
		<div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
			<section className="flex min-w-0 flex-col overflow-hidden border border-edge-hairline bg-background lg:h-147">
				<header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-edge-hairline px-3 sm:px-4">
					<div className="flex min-w-0 items-center gap-3">
						<span aria-hidden className="size-1.5 shrink-0 bg-neon-blue" />
						<div className="min-w-0">
							<div className="flex items-baseline gap-2">
								<h2
									data-stage-emotion={def.id}
									className="truncate text-lg font-semibold tracking-tight sm:text-xl"
								>
									{def.name}
								</h2>
								<span className="shrink-0 font-mono text-[9px] text-muted-foreground">
									{def.id} / {def.en}
								</span>
							</div>
							<p className="mt-0.5 max-w-120 truncate text-[10px] text-muted-foreground">
								{def.desc}
							</p>
						</div>
					</div>

					<div className="flex shrink-0 divide-x divide-edge-hairline border border-edge-hairline">
						<button
							type="button"
							onClick={replay}
							className="inline-flex h-8 cursor-pointer items-center gap-1.5 px-2.5 font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-blue"
							title="重播当前表情动画与对白"
						>
							<RotateCcw className="size-3" />
							<span className="hidden sm:inline">重播</span>
						</button>
						<button
							type="button"
							onClick={onToggleTour}
							aria-pressed={isTouring}
							className={cn(
								"inline-flex h-8 cursor-pointer items-center gap-1.5 px-2.5 font-mono text-[9px] tracking-[0.08em] uppercase transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-blue",
								isTouring
									? "bg-foreground text-background"
									: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
							)}
							title={isTouring ? "暂停自动巡演" : "开始自动巡演"}
						>
							{isTouring ? <Pause className="size-3" /> : <Play className="size-3" />}
							<span className="hidden sm:inline">巡演</span>
						</button>
					</div>
				</header>

				<div
					ref={stageRef}
					onPointerMove={handleStageMove}
					onPointerLeave={() => mascotRef.current?.setGaze(0, 0)}
					className="mascot-stage-scene relative h-[clamp(20rem,42dvh,26rem)] min-h-0 overflow-hidden lg:h-auto lg:flex-1"
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

				<footer className="flex min-h-9 shrink-0 items-center justify-between gap-3 border-t border-edge-hairline px-3 text-[9px] text-muted-foreground sm:px-4">
					<p>移动指针控制视线，点击角色让它弹跳</p>
					<p className="hidden font-mono tracking-[0.14em] uppercase sm:block">
						实时 SVG 渲染
					</p>
				</footer>
			</section>

			<aside className="flex h-80 min-h-0 flex-col overflow-hidden border border-edge-hairline bg-background lg:h-147">
				<header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-edge-hairline px-3 sm:px-4">
					<div className="min-w-0">
						<p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
							控制台
						</p>
						<p className="mt-1 truncate font-mono text-[10px] text-neon-blue">
							#{activeId} / {def.en}
						</p>
					</div>
					<Segmented
						value={dockView}
						onValueChange={setDockView}
						segments={DOCK_SEGMENTS}
						className="shrink-0 font-mono text-[9px] tracking-[0.08em]"
					/>
				</header>

				<div hidden={dockView !== "states"} className="min-h-0 flex-1 overflow-hidden">
					<MascotEmotionLibrary
						group={group}
						groupList={groupList}
						activeId={activeId}
						onSelectGroup={onSelectGroup}
						onSelectEmotion={onSelectEmotion}
					/>
				</div>
				<div hidden={dockView !== "controls"} className="min-h-0 flex-1 overflow-hidden">
					<MascotDirectorPanel
						mascotRef={mascotRef}
						def={def}
						onAIMessage={onAIMessage}
					/>
				</div>
			</aside>
		</div>
	);
}
