import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { cn } from "@/shared/lib/utils";
import type { EmotionDef } from "../../engine/expressions";
import { GROUP_LABEL, type MascotHandle, MascotStage } from "./MascotStage";

interface EmotionBubbleProps {
	text: string;
	gen: number;
}

/** 对白气泡:gen 变化重挂重播,台词寿命由 keyframes 一轮走完。 */
function EmotionBubble({ text, gen }: EmotionBubbleProps) {
	return (
		<div
			key={gen}
			className="animate-[mascot-bubble_4.5s_ease-in-out_forwards] motion-reduce:animate-none absolute top-2 right-0 z-10 w-38 rounded-xl bg-white px-3 py-2 text-left text-[11px] leading-snug font-medium text-[#3b3358] shadow-lg shadow-black/40 sm:w-44"
		>
			<span
				aria-hidden
				className="absolute bottom-0 left-3 size-2 translate-y-1/2 rotate-45 bg-white"
			/>
			{text}
		</div>
	);
}

interface StageAction {
	label: string;
	onClick: () => void;
	active?: boolean;
}

function StageButton({ label, onClick, active }: StageAction) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
				active
					? "border-violet-400/50 bg-violet-500/80 text-white hover:bg-violet-500"
					: "border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/10",
			)}
		>
			{label}
		</button>
	);
}

export interface MascotTheaterProps {
	def: EmotionDef;
	bubble: EmotionBubbleProps;
	isTouring: boolean;
	onToggleTour: () => void;
	/** AI 消息落定:同步固定选中与台词(由 handleAIMessage 解析后回调) */
	onAIMessage: (msg: { emotionId: string; tips?: string }) => void;
}

/**
 * 聚光舞台卡:锥形顶光 + 台面光斑 + 台口线的剧场布景,
 * 承载当前表情、对白气泡、动作按钮与 AI 协议实测入口。
 */
export function MascotTheater({
	def,
	bubble,
	isTouring,
	onToggleTour,
	onAIMessage,
}: MascotTheaterProps) {
	const heroRef = useRef<MascotHandle>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const jsonInputRef = useRef<HTMLTextAreaElement>(null);

	// 视线跟随:舞台内指针位置归一化为 [-1, 1],带 2.4 倍增益提前触及边缘
	const onStageMove = (e: ReactPointerEvent) => {
		const rect = stageRef.current?.getBoundingClientRect();
		if (!rect) return;
		const nx = Math.max(
			-1,
			Math.min(1, ((e.clientX - rect.left - rect.width / 2) / rect.width) * 2.4),
		);
		const ny = Math.max(
			-1,
			Math.min(1, ((e.clientY - rect.top - rect.height / 2) / rect.height) * 2.4),
		);
		heroRef.current?.setGaze(nx, ny);
	};

	const actions: StageAction[] = [
		{ label: "摸摸头", onClick: () => heroRef.current?.pet() },
		{ label: "转一圈", onClick: () => heroRef.current?.spin() },
		{ label: "撒花", onClick: () => heroRef.current?.burst(25) },
		{ label: "弹跳", onClick: () => heroRef.current?.bounce() },
	];
	const sendJson = () => {
		const raw = jsonInputRef.current?.value.trim();
		if (!raw) return;
		try {
			const msg = JSON.parse(raw);
			const result = heroRef.current?.handleAIMessage(msg);
			if (result) onAIMessage(result);
			jsonInputRef.current?.removeAttribute("aria-invalid");
		} catch {
			jsonInputRef.current?.setAttribute("aria-invalid", "true");
		}
	};

	return (
		<section
			ref={stageRef}
			onPointerMove={onStageMove}
			className="relative overflow-hidden rounded-2xl bg-[#141020] text-center shadow-2xl shadow-black/30 ring-1 ring-white/10"
		>
			{/* 剧场顶光:锥形光束从头顶打向台面(clip-path 锥形 × 顶亮底衰渐变) */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-linear-to-b from-[rgba(255,245,214,0.55)] via-[rgba(254,240,190,0.22)] to-transparent [clip-path:polygon(42%_0%,58%_0%,88%_100%,12%_100%)]"
			/>
			{/* 台面:猫脚下的椭圆聚光斑 */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-[radial-gradient(ellipse_56%_58%_at_50%_100%,rgba(254,242,205,0.38),rgba(253,230,138,0.16)_42%,transparent_70%)]"
			/>
			{/* 台口线:舞台前沿,中央亮两端隐没 */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-6 bottom-[23%] h-px bg-linear-to-r from-transparent via-[rgba(254,242,205,0.45)] to-transparent"
			/>
			{/* 剧场暗角 */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_78%_68%_at_50%_42%,transparent_52%,rgba(8,5,15,0.62)_100%)]"
			/>

			<div className="relative px-6 pt-7 pb-6 sm:px-8">
				<p className="flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">
					{GROUP_LABEL[def.group]}
					<span aria-hidden className="text-white/25">
						·
					</span>
					#{def.id}
					<span aria-hidden className="size-1 animate-pulse rounded-full bg-violet-300" />
				</p>

				<div className="relative mx-auto mt-2 w-fit">
					<MascotStage
						ref={heroRef}
						emotion={def.id}
						onClick={() => heroRef.current?.bounce()}
						className="size-52 cursor-pointer sm:size-60"
					/>
					<EmotionBubble text={bubble.text} gen={bubble.gen} />
				</div>

				<h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
					{def.name}
					<span className="ml-2 font-mono text-sm font-normal text-white/45">
						{def.en}
					</span>
				</h2>

				<div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
					{actions.map((a) => (
						<StageButton key={a.label} {...a} />
					))}
					<StageButton
						label={isTouring ? "暂停巡演" : "自动巡演"}
						onClick={onToggleTour}
						active={isTouring}
					/>
				</div>

				<p className="mt-3.5 text-[10px] text-white/30">
					头部轻拂触发呼噜飞机耳 · 点击身体弹跳 · 移动鼠标视线追随
				</p>

				{/* AI 消息实测:输入协议 JSON,实时驱动舞台 */}
				<div className="mt-5 text-left" aria-live="polite">
					<div className="flex gap-2">
						<textarea
							ref={jsonInputRef}
							rows={2}
							spellCheck={false}
							placeholder={`{"emotionId": "${def.id}", "tips": "喵~"}`}
							className="min-w-0 flex-1 resize-none rounded-lg border border-white/12 bg-black/30 px-3 py-2 font-mono text-[11px] text-white/85 placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none"
						/>
						<button
							type="button"
							onClick={sendJson}
							className="shrink-0 cursor-pointer rounded-lg bg-violet-500/90 px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-violet-500"
						>
							发送
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}
