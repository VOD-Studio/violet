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
			className="animate-[mascot-bubble_4.5s_ease-in-out_forwards] motion-reduce:animate-none absolute top-3.5 right-4 z-10 w-38 rounded-xl bg-[#fffaee] px-3 py-2 text-left text-[11px] leading-snug font-medium text-[#3b3358] shadow-lg shadow-[#4a3814]/45 ring-1 ring-[#ffe9bd]/60 sm:top-5 sm:right-6 sm:w-44"
		>
			<span
				aria-hidden
				className="absolute bottom-0 left-3 size-2 translate-y-1/2 rotate-45 bg-[#fffaee]"
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

/** 光束微尘:left/top 定位与节奏错开,光柱里有没有介质飘浮决定像不像真光 */
const DUST_MOTES = [
	{ key: "l", left: "46.5%", top: "38%", duration: "9s", delay: "0s" },
	{ key: "c", left: "51%", top: "58%", duration: "11s", delay: "-5s" },
	{ key: "r", left: "54%", top: "26%", duration: "8s", delay: "-2.5s" },
];

export interface MascotTheaterProps {
	def: EmotionDef;
	bubble: EmotionBubbleProps;
	isTouring: boolean;
	onToggleTour: () => void;
	/** AI 消息落定:同步固定选中与台词(由 handleAIMessage 解析后回调) */
	onAIMessage: (msg: { emotionId: string; tips?: string }) => void;
}

/**
 * 聚光舞台卡:上段舞台场景(顶光光束、猫脚下台面光斑、台口溢光),
 * 下段观众席控制区(动作按钮与 AI 协议实测),布景层均不接事件。
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
			className="relative overflow-hidden rounded-2xl bg-[#151022] text-center shadow-2xl shadow-black/30 ring-1 ring-white/10"
		>
			{/* 舞台场景区:猫是唯一交互主体,布景层全部 pointer-events-none */}
			<div className="relative h-72 overflow-hidden bg-[#100b1c] sm:h-88">
				{/* 后墙环境冷光:暗部留冷紫底,猫的轮廓才读得出来 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_52%_at_50%_44%,rgba(97,80,153,0.15),transparent_72%)]"
				/>
				{/* 台面地板:受光地界比后墙略亮 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 bottom-0 h-38 bg-linear-to-b from-transparent via-[rgba(104,86,158,0.09)] to-[rgba(104,86,158,0.15)]"
				/>
				{/* 两侧台翼暗化:舞台进深 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0 w-[15%] bg-linear-to-r from-[rgba(8,5,16,0.6)] to-transparent"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 right-0 w-[15%] bg-linear-to-l from-[rgba(8,5,16,0.6)] to-transparent"
				/>
				{/* 顶光光束:光源悬在舞台上方,conic 楔形两侧各 18° 半影衰减,近台面渐隐 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[conic-gradient(at_50%_-22%,transparent_43.5%,rgba(255,243,209,0.2)_48.5%_51.5%,transparent_56.5%)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_55%,transparent_92%)]"
				/>
				{/* 灯具源光:顶部一簇热核 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(ellipse_30%_62%_at_50%_0%,rgba(255,247,224,0.33),rgba(255,247,224,0.1)_45%,transparent_70%)]"
				/>
				{/* 台面光斑:热核 + 柔边两层,中心正对猫脚 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_46%_20%_at_50%_86%,rgba(255,242,205,0.24),rgba(255,242,205,0.08)_52%,transparent_74%)]"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_24%_9%_at_50%_87%,rgba(255,246,222,0.4),transparent_72%)]"
				/>
				{/* 台口溢光:漫过舞台前沿被裁掉,光"到边外去"的边界感 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_64%_24%_at_50%_106%,rgba(255,240,200,0.12),transparent_68%)]"
				/>
				{/* 台口沿:中央亮的发丝线 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-[rgba(255,242,205,0.28)] to-transparent"
				/>
				{/* 舞台暗角:只收舞台四角,不碰控制区 */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_88%_78%_at_50%_42%,transparent_56%,rgba(7,4,14,0.5)_100%)]"
				/>
				{DUST_MOTES.map((d) => (
					<span
						key={d.key}
						aria-hidden
						style={{
							left: d.left,
							top: d.top,
							animationDuration: d.duration,
							animationDelay: d.delay,
						}}
						className="animate-[mascot-dust_linear_infinite] motion-reduce:hidden absolute size-1 rounded-full bg-[#ffedbe]/60"
					/>
				))}

				<p className="absolute inset-x-0 top-3.5 z-10 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">
					{GROUP_LABEL[def.group]}
					<span aria-hidden className="text-white/25">
						·
					</span>
					#{def.id}
					<span aria-hidden className="size-1 animate-pulse rounded-full bg-violet-300" />
				</p>

				<MascotStage
					ref={heroRef}
					emotion={def.id}
					onClick={() => heroRef.current?.bounce()}
					className="absolute bottom-[11%] left-1/2 size-52 -translate-x-1/2 cursor-pointer drop-shadow-[0_0_18px_rgba(255,240,200,0.14)] sm:size-60"
				/>
				<EmotionBubble text={bubble.text} gen={bubble.gen} />
			</div>

			{/* 观众席控制区:舞台外,不打光 */}
			<div className="relative px-6 pt-5 pb-6 sm:px-8">
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
