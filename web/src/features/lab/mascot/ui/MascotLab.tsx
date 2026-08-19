import {
	type PointerEvent as ReactPointerEvent,
	type Ref,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { copyText } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/utils";
import { EMOTION_MAP, EMOTIONS, type EmotionDef } from "../engine/expressions";
import { Mascot } from "../engine/mascot";

export interface MascotHandle {
	spin(): void;
	burst(count?: number): void;
	bounce(): void;
	pet(): void;
	setGaze(nx: number, ny: number): void;
	setEmotion(id: string): void;
}

interface MascotStageProps {
	emotion: string;
	frozen?: boolean;
	onClick?: () => void;
	onPet?: () => void;
	ref?: Ref<MascotHandle>;
	className?: string;
}

function MascotStage({
	emotion,
	frozen = false,
	onClick,
	onPet,
	ref,
	className,
}: MascotStageProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const mascotRef = useRef<Mascot | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 实例仅建一次,后续变化走 setEmotion
	useEffect(() => {
		if (!hostRef.current) return;
		const m = new Mascot(hostRef.current, { emotion, frozen, onClick, onPet });
		mascotRef.current = m;
		return () => {
			m.destroy();
			mascotRef.current = null;
		};
	}, []);

	useEffect(() => {
		mascotRef.current?.setEmotion(emotion);
	}, [emotion]);

	useEffect(() => {
		if (!ref) return;
		const handle: MascotHandle = {
			spin: () => mascotRef.current?.spinTurns(1),
			burst: (count = 20) => mascotRef.current?.burst(count),
			bounce: () => mascotRef.current?.bounce(),
			pet: () => mascotRef.current?.pet(1200),
			setGaze: (nx: number, ny: number) => mascotRef.current?.setGaze(nx, ny),
			setEmotion: (id) => mascotRef.current?.setEmotion(id),
		};
		if (typeof ref === "function") ref(handle);
		else ref.current = handle;
		return () => {
			if (typeof ref === "function") ref(null as never);
			else ref.current = null;
		};
	}, [ref]);

	return <div ref={hostRef} className={className} />;
}

function EmotionGridItem({
	def,
	active,
	onSelect,
}: {
	def: EmotionDef;
	active: boolean;
	onSelect: () => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const mascotRef = useRef<Mascot | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		const m = new Mascot(hostRef.current, { emotion: def.id, frozen: true });
		mascotRef.current = m;
		return () => {
			m.destroy();
			mascotRef.current = null;
		};
	}, [def.id]);

	return (
		<div
			onClick={onSelect}
			onKeyDown={(e) => e.key === "Enter" && onSelect()}
			onPointerEnter={() => mascotRef.current?.start()}
			onPointerLeave={() => mascotRef.current?.stop()}
			tabIndex={0}
			role="button"
			className={cn(
				"group relative flex cursor-pointer flex-col items-center justify-between rounded-xl border p-3.5 text-center transition-colors duration-150",
				active
					? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
					: "border-border bg-card hover:border-foreground/40",
			)}
		>
			<div className="flex w-full items-center justify-between font-mono text-[11px] text-muted-foreground">
				<span>#{def.id}</span>
			</div>

			<div ref={hostRef} className="my-1.5 size-18" />

			<div className="w-full">
				<p className="truncate text-xs font-medium text-foreground">{def.name}</p>
				<p className="truncate font-mono text-[10px] text-muted-foreground">{def.en}</p>
			</div>
		</div>
	);
}

/**
 * 吉祥物形象与物理引擎展馆组件，提供核心互动舞台与 36 套动作表情陈列看板。
 */
export function MascotLab() {
	const [emotionId, setEmotionId] = useState("00");
	const [copied, setCopied] = useState(false);
	const [isTouring, setIsTouring] = useState(false);
	const tourTimerRef = useRef<number | null>(null);

	const def = useMemo(() => EMOTION_MAP.get(emotionId) ?? EMOTIONS[0], [emotionId]);
	const heroRef = useRef<MascotHandle>(null);
	const stageRef = useRef<HTMLDivElement>(null);

	const lifecycleEmotions = useMemo(() => EMOTIONS.filter((e) => e.group === "lifecycle"), []);
	const reactionEmotions = useMemo(() => EMOTIONS.filter((e) => e.group === "emotion"), []);
	const agentEmotions = useMemo(() => EMOTIONS.filter((e) => e.group === "agent"), []);

	const toggleTour = useCallback(() => {
		if (isTouring) {
			if (tourTimerRef.current) clearInterval(tourTimerRef.current);
			tourTimerRef.current = null;
			setIsTouring(false);
		} else {
			setIsTouring(true);
			tourTimerRef.current = window.setInterval(() => {
				setEmotionId((prev) => {
					const curIdx = EMOTIONS.findIndex((e) => e.id === prev);
					const nextIdx = (curIdx + 1) % EMOTIONS.length;
					return EMOTIONS[nextIdx].id;
				});
			}, 3200);
		}
	}, [isTouring]);

	useEffect(() => {
		return () => {
			if (tourTimerRef.current) clearInterval(tourTimerRef.current);
		};
	}, []);

	const onStageMove = useCallback((e: ReactPointerEvent) => {
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
	}, []);

	const handleCopyJson = () => {
		copyText(JSON.stringify({ emotionId: def.id, tips: def.desc }));
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="space-y-16 pb-24">
			{/* 1. 核心互动舞台 (The Stage Card) */}
			<section
				ref={stageRef}
				onPointerMove={onStageMove}
				className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12"
			>
				<span className="font-mono text-xs uppercase text-muted-foreground">
					#{def.id} · {def.group}
				</span>

				{/* 260px 纯净吉祥物本体 */}
				<div className="my-6">
					<MascotStage
						ref={heroRef}
						emotion={emotionId}
						onClick={() => heroRef.current?.bounce()}
						className="size-64 cursor-pointer sm:size-72"
					/>
				</div>

				<h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					{def.name}
					<span className="ml-2.5 font-mono text-base font-normal text-muted-foreground">
						{def.en}
					</span>
				</h2>
				<p className="mt-2 max-w-md text-sm text-muted-foreground">{def.desc}</p>

				{/* 动作与互动按钮组 */}
				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => heroRef.current?.pet()}
						className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						摸摸头
					</button>
					<button
						type="button"
						onClick={() => heroRef.current?.spin()}
						className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						转一圈
					</button>
					<button
						type="button"
						onClick={() => heroRef.current?.burst(25)}
						className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						撒花
					</button>
					<button
						type="button"
						onClick={() => heroRef.current?.bounce()}
						className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						弹跳
					</button>
					<button
						type="button"
						onClick={toggleTour}
						className={cn(
							"cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors",
							isTouring
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-background text-foreground hover:bg-accent",
						)}
					>
						{isTouring ? "暂停巡演" : "自动巡演"}
					</button>
					<button
						type="button"
						onClick={handleCopyJson}
						className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						{copied ? "已复制 JSON" : "复制协议 JSON"}
					</button>
				</div>

				{/* 互动小提示 */}
				<p className="mt-4 text-[11px] text-muted-foreground">
					💡
					提示：在猫咪头部轻拂鼠标可触发舒服呼噜飞机耳，点击身体可弹跳，移动鼠标体验视线追随
				</p>
			</section>
			{/* 2. 三大板块陈列看板 (The Editorial Showcases) */}
			<section className="space-y-12">
				{/* 板块 A：生命周期 */}
				<div className="space-y-4">
					<div className="flex items-baseline justify-between border-b border-border pb-2.5">
						<h3 className="text-base font-semibold text-foreground">生命周期状态</h3>
						<span className="font-mono text-xs text-muted-foreground">
							00-07 · 8 种状态
						</span>
					</div>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
						{lifecycleEmotions.map((e) => (
							<EmotionGridItem
								key={e.id}
								def={e}
								active={e.id === emotionId}
								onSelect={() => setEmotionId(e.id)}
							/>
						))}
					</div>
				</div>

				{/* 板块 B：情绪反应 */}
				<div className="space-y-4">
					<div className="flex items-baseline justify-between border-b border-border pb-2.5">
						<h3 className="text-base font-semibold text-foreground">情绪反应体系</h3>
						<span className="font-mono text-xs text-muted-foreground">
							10-25 · 16 种状态
						</span>
					</div>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
						{reactionEmotions.map((e) => (
							<EmotionGridItem
								key={e.id}
								def={e}
								active={e.id === emotionId}
								onSelect={() => setEmotionId(e.id)}
							/>
						))}
					</div>
				</div>

				{/* 板块 C：工作状态 */}
				<div className="space-y-4">
					<div className="flex items-baseline justify-between border-b border-border pb-2.5">
						<h3 className="text-base font-semibold text-foreground">代理工作状态</h3>
						<span className="font-mono text-xs text-muted-foreground">
							30-42 · 13 种状态
						</span>
					</div>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
						{agentEmotions.map((e) => (
							<EmotionGridItem
								key={e.id}
								def={e}
								active={e.id === emotionId}
								onSelect={() => setEmotionId(e.id)}
							/>
						))}
					</div>
				</div>
			</section>

			{/* 3. 接入协议与 SDK 说明 */}
			<section className="space-y-4">
				<div className="border-b border-border pb-2.5">
					<h3 className="text-base font-semibold text-foreground">AI 对接与实例化协议</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						通过标准 JSON 协议接收模型输出。未识别的表情 ID 将自动平滑回退待机。
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border border-border bg-card p-4 font-mono text-xs">
						<p className="mb-2 text-[11px] font-semibold text-muted-foreground">
							1. AI 交互协议
						</p>
						<pre className="overflow-x-auto text-foreground">
							{`ball.handleAIMessage({
  "emotionId": "${def.id}",
  "tips": "${def.desc.slice(0, 24)}..."
});`}
						</pre>
					</div>

					<div className="rounded-xl border border-border bg-card p-4 font-mono text-xs">
						<p className="mb-2 text-[11px] font-semibold text-muted-foreground">
							2. 原生实例化
						</p>
						<pre className="overflow-x-auto text-foreground">
							{`const ball = new Mascot(container, {
  emotion: "${def.id}",
  idle: true
});`}
						</pre>
					</div>
				</div>
			</section>
		</div>
	);
}
