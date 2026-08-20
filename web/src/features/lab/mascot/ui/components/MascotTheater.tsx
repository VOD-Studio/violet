import type { EmotionDef } from "@violet/mascot";
import { resolveEmotionId } from "@violet/mascot";
import type { MascotHandle } from "@violet/mascot/react";
import { MascotStage } from "@violet/mascot/react";
import {
	Hand,
	Pause,
	Play,
	RotateCcw,
	RotateCw,
	Send,
	Sparkles,
	Terminal,
	Zap,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { GROUP_LABEL } from "../hooks/useMascotExhibit";

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
	icon: React.ReactNode;
	onClick: () => void;
}

/**
 * 动作按钮:瞬时互动手势。交互状态只走背景/文字/阴影通道——
 * 激活与悬停永不改变占布局的几何(border/padding/尺寸),杜绝工具栏抖动。
 */
function StageButton({ label, icon, onClick }: StageAction) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/70 transition-[color,background-color,box-shadow] hover:duration-0 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
		>
			{icon}
			<span>{label}</span>
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
	onReplay: () => void;
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
	onReplay,
	onAIMessage,
}: MascotTheaterProps) {
	const heroRef = useRef<MascotHandle>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const jsonInputRef = useRef<HTMLTextAreaElement>(null);
	const agentMsg = useAgentStatus();
	const agentEmotion = agentMsg ? resolveEmotionId(agentMsg) : null;

	// 视线跟随:仅指针在舞台场景区内时跟随,位置归一化为 [-1, 1],带 2.4 倍增益提前触及边缘;
	// 离开舞台(进入控制区或卡片外)视线回中
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

	const onStageLeave = () => heroRef.current?.setGaze(0, 0);

	const antics: StageAction[] = [
		{
			label: "摸头",
			icon: <Hand className="size-3.5" />,
			onClick: () => heroRef.current?.pet(),
		},
		{
			label: "转圈",
			icon: <RotateCw className="size-3.5" />,
			onClick: () => heroRef.current?.spin(),
		},
		{
			label: "撒花",
			icon: <Sparkles className="size-3.5" />,
			onClick: () => heroRef.current?.burst(25),
		},
		{
			label: "弹跳",
			icon: <Zap className="size-3.5" />,
			onClick: () => heroRef.current?.bounce(),
		},
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

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendJson();
		}
	};
	return (
		<section className="relative overflow-hidden rounded-2xl bg-[#151022] text-center shadow-2xl shadow-black/30 ring-1 ring-white/10">
			{/* 舞台场景区:猫是唯一交互主体,布景层全部 pointer-events-none;指针仅在此区内驱动视线 */}
			<div
				ref={stageRef}
				onPointerMove={onStageMove}
				onPointerLeave={onStageLeave}
				className="relative h-72 overflow-hidden bg-[#100b1c] sm:h-88"
			>
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

				{/* 舞台顶栏 HUD: 左侧状态小签 + 右侧播放/巡演控制器 */}
				<p className="absolute inset-x-0 top-3.5 z-10 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">
					{GROUP_LABEL[def.group]}
					<span aria-hidden className="text-white/20">
						·
					</span>
					#{def.id}
					{agentMsg && (
						<>
							<span aria-hidden className="text-white/20">
								·
							</span>
							<span data-agent-state={agentMsg.state} className="text-amber-200/70">
								{agentMsg.agent} {agentMsg.state}
							</span>
						</>
					)}
					<span
						aria-hidden
						className="size-1 animate-pulse rounded-full bg-emerald-400/80"
					/>
				</p>

				<MascotStage
					ref={heroRef}
					emotion={agentEmotion ?? def.id}
					onClick={() => heroRef.current?.bounce()}
					className="absolute bottom-[11%] left-1/2 size-52 -translate-x-1/2 cursor-pointer drop-shadow-[0_0_18px_rgba(255,240,200,0.14)] sm:size-60"
				/>
				<EmotionBubble text={bubble.text} gen={bubble.gen} />
			</div>
			{/* 观众席控制区:舞台外,不打光 */}
			{/* 观众席控制区:舞台外,不打光，严格固定各行几何高度消除切换抖动 */}
			<div className="relative px-5 pt-4 pb-5 sm:px-6">
				{/* 顶栏：表情名称与展馆播放控制 */}
				<div className="flex h-7 items-center justify-between">
					<div className="flex items-center gap-2">
						<h2 className="text-lg font-bold leading-none tracking-tight text-white sm:text-xl">
							{def.name}
						</h2>
						<span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-normal leading-none text-white/50">
							{def.en}
						</span>
					</div>

					{/* 展馆播放控制：重播与巡演 */}
					<div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 shadow-xs backdrop-blur-md">
						<button
							type="button"
							onClick={() => {
								heroRef.current?.setEmotion(def.id);
								onReplay();
							}}
							className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2.5 font-mono text-[11px] text-white/70 transition-[color,background-color,box-shadow] hover:duration-0 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
							title="重播当前表情动画与对白"
						>
							<RotateCcw className="size-3" />
							<span>重播</span>
						</button>
						<div className="h-3 w-px bg-white/10" aria-hidden />
						<button
							type="button"
							onClick={onToggleTour}
							aria-pressed={isTouring}
							className={cn(
								"inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2.5 font-mono text-[11px] transition-[color,background-color,box-shadow] hover:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
								// 激活态用 ring-inset 替代 border:box-shadow 通道不占布局,开关切换零位移
								isTouring
									? "bg-white/15 text-white shadow-xs shadow-black/20 ring-1 ring-white/25 ring-inset"
									: "text-white/70 hover:bg-white/10 hover:text-white",
							)}
							title={isTouring ? "暂停自动巡演" : "开始自动巡演"}
						>
							{isTouring ? <Pause className="size-3" /> : <Play className="size-3" />}
							<span>巡演</span>
						</button>
					</div>
				</div>

				{/* 描述文案 */}
				<div className="mt-1 flex h-4 items-center">
					<p className="truncate text-xs leading-none text-white/45">{def.desc}</p>
				</div>

				{/* 互动动作工具栏：纯粹的 4 个猫猫互动手势 */}
				<div className="mt-3.5 flex h-9 items-center justify-center">
					<div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-md shadow-black/25 backdrop-blur-md">
						{antics.map((a) => (
							<StageButton key={a.label} {...a} />
						))}
					</div>
				</div>
				<div className="mt-2 flex h-3.5 items-center justify-center">
					<p className="text-[10px] leading-none text-white/25">
						轻触头部触发飞机耳 · 点击身体弹跳 · 移动指针视线追随
					</p>
				</div>

				{/* AI 消息协议控制台: 多行代码编辑区 + 底部操作栏 */}
				<div className="mt-3.5 text-left" aria-live="polite">
					<div className="mb-1.5 flex h-4 items-center justify-between px-0.5">
						<span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-white/40 uppercase">
							<Terminal className="size-3 text-white/60" />
							AI 消息协议控制台
						</span>
						<span className="font-mono text-[10px] text-white/25">
							Enter 发送 · Shift+Enter 换行
						</span>
					</div>
					<div className="rounded-xl border border-white/10 bg-black/45 p-2 transition-[border-color,background-color,box-shadow] focus-within:border-white/25 focus-within:bg-black/65 focus-within:ring-1 focus-within:ring-white/10 has-[textarea[aria-invalid=true]]:border-red-400/50">
						<textarea
							ref={jsonInputRef}
							rows={2}
							onKeyDown={handleKeyDown}
							spellCheck={false}
							placeholder={`{\n  "emotionId": "${def.id}",\n  "tips": "喵~"\n}`}
							className="code-block-scrollbar max-h-28 min-h-[44px] w-full resize-none bg-transparent px-1 py-0.5 font-mono text-[11px] leading-relaxed text-white/90 placeholder:text-white/25 focus:outline-none"
						/>
						<div className="mt-1.5 flex items-center justify-between border-t border-white/[0.06] pt-1.5">
							<span className="font-mono text-[10px] text-white/30">
								JSON Protocol
							</span>
							<button
								type="button"
								onClick={sendJson}
								className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-950 shadow-xs transition-[color,background-color,box-shadow] hover:duration-0 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
							>
								<Send className="size-3 text-neutral-950" />
								<span>发送</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
