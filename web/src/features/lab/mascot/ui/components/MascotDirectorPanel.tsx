import type { EmotionDef } from "@violet/mascot";
import type { MascotHandle } from "@violet/mascot/react";
import {
	Hand,
	Heart,
	PartyPopper,
	Rocket,
	RotateCw,
	Send,
	Sparkles,
	Terminal,
	WandSparkles,
	Zap,
} from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/shared/lib/utils";

interface StageAction {
	label: string;
	description?: string;
	icon: ReactNode;
	onClick: () => void;
	active?: boolean;
}

function StageActionButton({ label, description, icon, onClick, active }: StageAction) {
	const isEffect = description !== undefined;
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"cursor-pointer text-[#11110f] transition-colors duration-200 hover:bg-[#eceee9] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent)",
				isEffect
					? "flex min-h-12 flex-col items-start justify-center bg-[#f8f9f5] px-2 py-1.5 text-left"
					: "flex min-h-12 flex-col items-center justify-center gap-1 bg-white p-1 text-center",
				active && "bg-[#ebe7e0] text-(--mascot-accent) hover:bg-[#ebe7e0]",
			)}
		>
			<span className={cn("flex items-center", isEffect ? "gap-1.5" : "flex-col gap-1")}>
				{icon}
				<span className="text-[10px] font-bold leading-none">{label}</span>
			</span>
			{description ? (
				<span className="mt-1 pl-5 text-[9px] leading-none text-[#11110f]/45">
					{description}
				</span>
			) : null}
		</button>
	);
}

/** 角色控制台依赖主舞台实例，并将协议消息同步给展馆状态。 */
export interface MascotDirectorPanelProps {
	mascotRef: RefObject<MascotHandle | null>;
	def: EmotionDef;
	onAIMessage: (emotionId: string, tips?: string) => void;
}

/** 动作、特效、姿态与 AI 消息集中在角色旁边的导演控制台。 */
export function MascotDirectorPanel({ mascotRef, def, onAIMessage }: MascotDirectorPanelProps) {
	const jsonInputRef = useRef<HTMLTextAreaElement>(null);
	const [devYaw, setDevYaw] = useState(0);
	const [isMagicPersistent, setIsMagicPersistent] = useState(false);
	const [protocolError, setProtocolError] = useState<string | null>(null);

	useEffect(() => {
		mascotRef.current?.setDevYaw(devYaw);
	}, [devYaw, mascotRef]);

	const antics: StageAction[] = [
		{
			label: "摸头",
			icon: <Hand className="size-3.5" />,
			onClick: () => mascotRef.current?.pet(),
		},
		{
			label: "转圈",
			icon: <RotateCw className="size-3.5" />,
			onClick: () => mascotRef.current?.spin(),
		},
		{
			label: "撒花",
			icon: <Sparkles className="size-3.5" />,
			onClick: () => mascotRef.current?.burst(25),
		},
		{
			label: "弹跳",
			icon: <Zap className="size-3.5" />,
			onClick: () => mascotRef.current?.bounce(),
		},
	];

	const effects: StageAction[] = [
		{
			label: isMagicPersistent ? "收起阵" : "魔法阵",
			description: isMagicPersistent ? "常驻地面" : "脚下召唤",
			icon: <WandSparkles className="size-3.5" />,
			active: isMagicPersistent,
			onClick: () => {
				const next = !isMagicPersistent;
				setIsMagicPersistent(next);
				mascotRef.current?.setMagicPersistent(next, {
					size: 1.04,
					intensity: 0.84,
					speed: 0.32,
				});
			},
		},
		{
			label: "彩带",
			description: "轻薄流线",
			icon: <Sparkles className="size-3.5" />,
			onClick: () => mascotRef.current?.streamers(),
		},
		{
			label: "流星",
			description: "许愿掠过",
			icon: <Rocket className="size-3.5" />,
			onClick: () => mascotRef.current?.meteors(),
		},
		{
			label: "烟花",
			description: "高空绽放",
			icon: <PartyPopper className="size-3.5" />,
			onClick: () => mascotRef.current?.fireworks(),
		},
		{
			label: "爱心雨",
			description: "甜蜜落下",
			icon: <Heart className="size-3.5" />,
			onClick: () => mascotRef.current?.hearts(),
		},
		{
			label: "闪耀",
			description: "聚光登场",
			icon: <Sparkles className="size-3.5" />,
			onClick: () => mascotRef.current?.spotlight(),
		},
	];

	const sendJson = () => {
		const raw = jsonInputRef.current?.value.trim();
		if (!raw) {
			setProtocolError("先输入一段 JSON 消息");
			return;
		}
		try {
			const result = mascotRef.current?.handleAIMessage(JSON.parse(raw));
			if (result) onAIMessage(result.emotionId, result.tips);
			setProtocolError(null);
		} catch {
			setProtocolError("JSON 格式有误，请检查后重试");
		}
	};

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			sendJson();
		}
	};

	return (
		<aside className="flex min-h-0 flex-col border-2 border-[#11110f] bg-[#f8f9f5] lg:h-147">
			<header className="flex h-14 shrink-0 items-center justify-between bg-[#11110f] px-3 text-white">
				<div>
					<p className="font-mono text-[9px] tracking-[0.18em] text-white/55">
						Director desk
					</p>
					<h2 className="mt-0.5 text-base font-black tracking-[-0.03em]">导演台</h2>
				</div>
				<span className="border border-white/35 px-1.5 py-1 font-mono text-[9px] text-white/70">
					Live control
				</span>
			</header>

			<section className="border-b border-[#11110f] p-2.5">
				<p className="mb-1.5 text-[10px] font-bold">角色动作</p>
				<div className="grid grid-cols-4 gap-1">
					{antics.map((action) => (
						<StageActionButton key={action.label} {...action} />
					))}
				</div>
			</section>

			<section className="border-b border-[#11110f] p-2.5">
				<div className="mb-1.5 flex items-center justify-between gap-2">
					<p className="text-[10px] font-bold">舞台特效</p>
					<p className="font-mono text-[9px] text-[#11110f]/45">可叠加</p>
				</div>
				<div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">
					{effects.map((action) => (
						<StageActionButton key={action.label} {...action} />
					))}
				</div>
			</section>

			<section className="border-b border-[#11110f] p-2.5">
				<div className="flex items-center justify-between">
					<label htmlFor="mascot-yaw" className="text-[10px] font-bold">
						手动方向
					</label>
					<output
						htmlFor="mascot-yaw"
						className="font-mono text-xs font-semibold tabular-nums"
					>
						{devYaw}°
					</output>
				</div>
				<input
					id="mascot-yaw"
					type="range"
					min={-360}
					max={360}
					step={5}
					value={devYaw}
					onChange={(event) => setDevYaw(Number(event.target.value))}
					className="mt-2 h-1 w-full cursor-pointer appearance-none bg-[#11110f]/20 accent-(--mascot-accent)"
				/>
				<div className="mt-1 flex justify-between font-mono text-[8px] text-[#11110f]/40">
					<span>-360°</span>
					<span>正面</span>
					<span>+360°</span>
				</div>
			</section>

			<section className="flex min-h-0 flex-1 flex-col p-2.5" aria-live="polite">
				<div className="mb-1.5 flex items-center justify-between gap-2">
					<p className="inline-flex items-center gap-1.5 text-[10px] font-bold">
						<Terminal className="size-3.5" />
						AI 消息
					</p>
					<p className="font-mono text-[8px] text-[#11110f]/40">Enter 发送</p>
				</div>
				<div
					className={cn(
						"flex min-h-0 flex-1 flex-col bg-[#eceee9] transition-colors focus-within:bg-white",
						protocolError && "bg-[#f7e6e1]",
					)}
				>
					<textarea
						ref={jsonInputRef}
						rows={2}
						onKeyDown={handleKeyDown}
						spellCheck={false}
						aria-label="AI 消息 JSON"
						aria-invalid={protocolError ? true : undefined}
						placeholder={`{\n  "emotionId": "${def.id}",\n  "tips": "喵~"\n}`}
						className="min-h-17 flex-1 resize-none bg-transparent p-2 font-mono text-[10px] leading-relaxed text-[#11110f] outline-none placeholder:text-[#11110f]/30"
					/>
					<div className="flex min-h-8 items-center justify-between gap-2 px-2 pb-2">
						<p
							className={cn(
								"truncate font-mono text-[8px] text-[#11110f]/55",
								protocolError && "text-(--mascot-accent)",
							)}
						>
							{protocolError ?? "JSON protocol"}
						</p>
						<button
							type="button"
							onClick={sendJson}
							className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#11110f] px-3 text-[10px] font-bold text-white transition-colors hover:bg-[#30312e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mascot-accent)"
						>
							<Send className="size-3" />
							发送
						</button>
					</div>
				</div>
			</section>
		</aside>
	);
}
