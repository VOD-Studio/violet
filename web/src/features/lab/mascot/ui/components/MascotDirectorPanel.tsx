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
import { OverlayScroll } from "@/shared/ui/overlay-scroll";

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
				"cursor-pointer border-r border-b border-edge-hairline bg-background text-foreground transition-colors hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-blue",
				isEffect
					? "flex min-h-14 items-center gap-2.5 px-2.5 py-2 text-left"
					: "flex min-h-14 flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center",
				active &&
					"bg-muted/60 text-neon-blue shadow-[inset_3px_0_0_var(--color-neon-blue)]",
			)}
		>
			<span className="inline-flex shrink-0 items-center justify-center text-neon-blue">
				{icon}
			</span>
			<span className={cn(isEffect && "min-w-0")}>
				<span className="block text-[10px] font-semibold leading-none">{label}</span>
				{description ? (
					<span className="mt-1 block truncate text-[9px] leading-none text-muted-foreground">
						{description}
					</span>
				) : null}
			</span>
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
		<OverlayScroll className="h-full min-h-0">
			<section className="border-b border-edge-hairline p-4">
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Hand className="size-3.5 text-neon-blue" />
						<div>
							<h3 className="text-xs font-semibold">角色动作</h3>
							<p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground uppercase">
								Instant feedback
							</p>
						</div>
					</div>
					<span className="font-mono text-[8px] text-muted-foreground">04</span>
				</div>
				<div className="grid grid-cols-4 border-t border-l border-edge-hairline">
					{antics.map((action) => (
						<StageActionButton key={action.label} {...action} />
					))}
				</div>
			</section>

			<section className="border-b border-edge-hairline p-4">
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<WandSparkles className="size-3.5 text-neon-blue" />
						<div>
							<h3 className="text-xs font-semibold">舞台特效</h3>
							<p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground uppercase">
								Stackable effects
							</p>
						</div>
					</div>
					<span className="font-mono text-[8px] text-muted-foreground">06</span>
				</div>
				<div className="grid grid-cols-2 border-t border-l border-edge-hairline">
					{effects.map((action) => (
						<StageActionButton key={action.label} {...action} />
					))}
				</div>
			</section>

			<section className="border-b border-edge-hairline p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<RotateCw className="size-3.5 text-neon-blue" />
						<div>
							<label htmlFor="mascot-yaw" className="text-xs font-semibold">
								手动方向
							</label>
							<p className="font-mono text-[8px] tracking-[0.08em] text-muted-foreground uppercase">
								Character yaw
							</p>
						</div>
					</div>
					<output
						htmlFor="mascot-yaw"
						className="font-mono text-[10px] tabular-nums text-neon-blue"
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
					className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-neon-blue"
				/>
				<div className="mt-1.5 flex justify-between font-mono text-[8px] text-muted-foreground">
					<span>-360°</span>
					<span>正面</span>
					<span>+360°</span>
				</div>
			</section>

			<section className="p-4" aria-live="polite">
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Terminal className="size-3.5 text-neon-blue" />
						<div>
							<h3 className="text-xs font-semibold">AI 消息</h3>
							<p className="font-mono text-[8px] tracking-[0.12em] text-muted-foreground uppercase">
								JSON protocol
							</p>
						</div>
					</div>
					<p className="font-mono text-[8px] text-muted-foreground">Enter 发送</p>
				</div>
				<div
					className={cn(
						"overflow-hidden border border-edge-hairline bg-background transition-colors focus-within:border-neon-blue",
						protocolError && "border-destructive",
					)}
				>
					<textarea
						ref={jsonInputRef}
						rows={4}
						onKeyDown={handleKeyDown}
						spellCheck={false}
						aria-label="AI 消息 JSON"
						aria-invalid={protocolError ? true : undefined}
						placeholder={`{\n  "emotionId": "${def.id}",\n  "tips": "喵~"\n}`}
						className="min-h-28 w-full resize-none bg-transparent p-3 font-mono text-[10px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
					/>
					<div className="flex min-h-10 items-center justify-between gap-2 border-t border-edge-hairline px-2.5 py-1.5">
						<p
							className={cn(
								"truncate font-mono text-[8px] text-muted-foreground",
								protocolError && "text-destructive",
							)}
						>
							{protocolError ?? "Ready to receive"}
						</p>
						<button
							type="button"
							onClick={sendJson}
							className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 bg-foreground px-3 font-mono text-[9px] tracking-[0.08em] text-background uppercase transition-colors hover:bg-neon-blue hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue"
						>
							<Send className="size-3" />
							发送
						</button>
					</div>
				</div>
			</section>
		</OverlayScroll>
	);
}
