import "./motion-effects.css";
import { MOTION_BEZIER, MOTION_DURATION, useInView, useReducedMotion } from "@shared/lib/motion";
import { cn } from "@shared/lib/utils";
import { Check, Copy } from "lucide-react";
import {
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

export interface MagneticProps {
	/** 磁吸强度（0~1，指针偏移的跟随比例，默认 0.3） */
	strength?: number;
	className?: string;
	children: ReactNode;
}

/** 磁吸纽扣：当指针靠近元素时微位移跟随，移出弹簧阻尼回弹。 */
export function Magnetic({ strength = 0.3, className, children }: MagneticProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [isHovered, setIsHovered] = useState(false);

	const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (reduce || !ref.current) return;
		const rect = ref.current.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const dx = (e.clientX - centerX) * strength;
		const dy = (e.clientY - centerY) * strength;
		setOffset({ x: dx, y: dy });
	};

	const handleMouseEnter = () => {
		setIsHovered(true);
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
		setOffset({ x: 0, y: 0 });
	};

	const style: CSSProperties = reduce
		? {}
		: {
				transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
				transition: isHovered
					? `transform ${MOTION_DURATION.press}s ease-out`
					: `transform 0.45s ${MOTION_BEZIER.spring}`,
				willChange: isHovered ? "transform" : "auto",
			};

	return (
		<div
			ref={ref}
			className={cn("inline-block", className)}
			style={style}
			onMouseMove={handleMouseMove}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{children}
		</div>
	);
}

export interface TiltCardProps {
	/** 最大倾斜角度（度，默认 8） */
	maxAngle?: number;
	/** 是否开启聚光灯跟随高光（默认 true） */
	spotlight?: boolean;
	/** 聚光灯颜色 */
	spotlightColor?: string;
	className?: string;
	children: ReactNode;
}

/** 3D 聚光灯卡片：鼠标移动时产生克制透视俯仰，伴随聚光灯跟随。 */
export function TiltCard({
	maxAngle = 8,
	spotlight = true,
	spotlightColor = "rgba(var(--primary-rgb, 120, 80, 200), 0.12)",
	className,
	children,
}: TiltCardProps) {
	const reduce = useReducedMotion();
	const cardRef = useRef<HTMLDivElement>(null);
	const [rotate, setRotate] = useState({ x: 0, y: 0 });
	const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

	const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (reduce || !cardRef.current) return;
		const rect = cardRef.current.getBoundingClientRect();
		const px = (e.clientX - rect.left) / rect.width;
		const py = (e.clientY - rect.top) / rect.height;
		const rotX = (0.5 - py) * (maxAngle * 2);
		const rotY = (px - 0.5) * (maxAngle * 2);
		setRotate({ x: rotX, y: rotY });
		setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
	};

	const handleMouseLeave = () => {
		setRotate({ x: 0, y: 0 });
		setPointer(null);
	};

	return (
		<div
			ref={cardRef}
			className={cn("relative overflow-hidden rounded-xl", className)}
			style={
				reduce
					? {}
					: {
							perspective: "1000px",
							transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
							transition: pointer
								? "transform 0.08s ease-out"
								: `transform 0.4s ${MOTION_BEZIER.out}`,
							willChange: pointer ? "transform" : "auto",
						}
			}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{children}
			{spotlight && pointer && !reduce && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 transition-opacity duration-300"
					style={{
						background: `radial-gradient(circle 200px at ${pointer.x}px ${pointer.y}px, ${spotlightColor}, transparent 80%)`,
					}}
				/>
			)}
		</div>
	);
}

export interface PillSliderItem {
	id: string;
	label: string;
}

export interface PillSliderProps {
	items: PillSliderItem[];
	activeId: string;
	onChange: (id: string) => void;
	className?: string;
}

/** 流体滑动胶囊：多选项切换时，背景胶囊利用纯 CSS 平滑滑移拉伸。 */
export function PillSlider({ items, activeId, onChange, className }: PillSliderProps) {
	const reduce = useReducedMotion();
	const containerRef = useRef<HTMLDivElement>(null);
	const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);

	const updatePill = useCallback(() => {
		if (!containerRef.current) return;
		const activeBtn = containerRef.current.querySelector<HTMLButtonElement>(
			`[data-pill-id='${activeId}']`,
		);
		if (!activeBtn) return;
		const containerRect = containerRef.current.getBoundingClientRect();
		const btnRect = activeBtn.getBoundingClientRect();
		setPillStyle({
			left: btnRect.left - containerRect.left,
			width: btnRect.width,
		});
	}, [activeId]);

	useLayoutEffect(() => {
		updatePill();
		window.addEventListener("resize", updatePill);
		return () => window.removeEventListener("resize", updatePill);
	}, [updatePill]);

	return (
		<div
			ref={containerRef}
			role="tablist"
			className={cn(
				"relative inline-flex items-center rounded-lg border border-border/40 bg-muted/40 p-1 select-none",
				className,
			)}
		>
			{pillStyle && (
				<span
					aria-hidden
					className="absolute top-1 bottom-1 rounded-md bg-card shadow-xs"
					style={{
						left: `${pillStyle.left}px`,
						width: `${pillStyle.width}px`,
						transition: reduce
							? "none"
							: `left ${MOTION_DURATION.modal}s ${MOTION_BEZIER.out}, width ${MOTION_DURATION.modal}s ${MOTION_BEZIER.out}`,
					}}
				/>
			)}
			{items.map((item) => {
				const active = item.id === activeId;
				return (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={active}
						data-pill-id={item.id}
						onClick={() => onChange(item.id)}
						className={cn(
							"relative z-10 px-3.5 py-1.5 text-xs font-medium transition-colors duration-200",
							active
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}

export interface CheckmarkDrawProps {
	checked: boolean;
	/** 尺寸（像素，默认 24） */
	size?: number;
	color?: string;
	className?: string;
}

/** 交互打勾绘制：操作成功时，圆环与对勾笔触通过 SVG 描边偏移勾出。 */
export function CheckmarkDraw({
	checked,
	size = 24,
	color = "currentColor",
	className,
}: CheckmarkDrawProps) {
	const reduce = useReducedMotion();

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={cn("inline-block overflow-visible align-middle", className)}
			aria-hidden="true"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke={color}
				strokeWidth="2"
				strokeDasharray="57"
				strokeDashoffset={checked || reduce ? "0" : "57"}
				style={{
					transition: reduce ? "none" : `stroke-dashoffset 0.35s ${MOTION_BEZIER.out}`,
				}}
			/>
			<path
				d="M8 12.5L10.8 15.3L16.2 9.5"
				stroke={color}
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray="18"
				strokeDashoffset={checked || reduce ? "0" : "18"}
				style={{
					transition: reduce
						? "none"
						: `stroke-dashoffset 0.28s ${MOTION_BEZIER.out} 0.12s`,
				}}
			/>
		</svg>
	);
}

export interface InkRippleProps {
	color?: string;
	className?: string;
	children: ReactNode;
	onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}

/** 墨晕涟漪：点击交互时以触点坐标为圆心扩散渐隐。 */
export function InkRipple({
	color = "rgba(120, 80, 200, 0.25)",
	className,
	children,
	onClick,
}: InkRippleProps) {
	const reduce = useReducedMotion();
	const [ripples, setRipples] = useState<
		Array<{ id: number; x: number; y: number; size: number }>
	>([]);

	const handleClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
		onClick?.(e);
		if (reduce) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const size = Math.max(rect.width, rect.height) * 2;
		const id = Date.now();

		setRipples((prev) => [...prev, { id, x, y, size }]);
		setTimeout(() => {
			setRipples((prev) => prev.filter((r) => r.id !== id));
		}, 600);
	};

	return (
		<button
			type="button"
			className={cn(
				"relative overflow-hidden inline-block cursor-pointer select-none text-left",
				className,
			)}
			onClick={handleClick}
		>
			{children}
			{ripples.map((ripple) => (
				<span
					key={ripple.id}
					aria-hidden
					className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						left: ripple.x,
						top: ripple.y,
						width: ripple.size,
						height: ripple.size,
						backgroundColor: color,
						animation: "ink-ripple-expand 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
					}}
				/>
			))}
		</button>
	);
}

export interface ShakeProps {
	/** 触发抖动的键值（每次数值变化触发一次摆动） */
	shakeKey: number;
	className?: string;
	children: ReactNode;
}

/** 警示摇晃：用于非法操作与验证失败时的阻尼物理摆动。 */
export function Shake({ shakeKey, className, children }: ShakeProps) {
	const reduce = useReducedMotion();
	const [animating, setAnimating] = useState(false);

	useEffect(() => {
		if (shakeKey === 0 || reduce) return;
		setAnimating(true);
		const timer = setTimeout(() => setAnimating(false), 400);
		return () => clearTimeout(timer);
	}, [shakeKey, reduce]);

	return (
		<div
			className={cn("inline-block", className)}
			style={animating ? { animation: "shake-damping 0.4s ease-in-out" } : undefined}
		>
			{children}
		</div>
	);
}

export interface HoldToConfirmProps {
	/** 蓄力时长（秒，默认 1.0） */
	duration?: number;
	onConfirm: () => void;
	label?: string;
	holdingLabel?: string;
	confirmedLabel?: string;
	className?: string;
}

/** 长按蓄力确认：按住蓄满方才确认，松开立即平滑回弹。 */
export function HoldToConfirm({
	duration = 1.0,
	onConfirm,
	label = "长按确认操作",
	holdingLabel = "松开取消…",
	confirmedLabel = "已确认完成",
	className,
}: HoldToConfirmProps) {
	const reduce = useReducedMotion();
	const [holding, setHolding] = useState(false);
	const [progress, setProgress] = useState(0);
	const [confirmed, setConfirmed] = useState(false);
	const timerRef = useRef<number | null>(null);
	const startTimeRef = useRef<number>(0);

	const cancelHold = () => {
		if (confirmed) return;
		setHolding(false);
		if (timerRef.current) cancelAnimationFrame(timerRef.current);
		setProgress(0);
	};

	const startHold = () => {
		if (confirmed) return;
		if (reduce) {
			setConfirmed(true);
			onConfirm();
			return;
		}
		setHolding(true);
		startTimeRef.current = performance.now();

		const step = (now: number) => {
			const elapsed = (now - startTimeRef.current) / 1000;
			const p = Math.min(elapsed / duration, 1);
			setProgress(p);

			if (p >= 1) {
				setConfirmed(true);
				setHolding(false);
				onConfirm();
			} else {
				timerRef.current = requestAnimationFrame(step);
			}
		};

		timerRef.current = requestAnimationFrame(step);
	};

	return (
		<button
			type="button"
			className={cn(
				"relative overflow-hidden rounded-lg border border-border/40 bg-card px-4 py-2.5 text-xs font-medium text-foreground select-none transition-shadow active:scale-[0.99]",
				confirmed && "border-primary/40 bg-primary/10 text-primary",
				className,
			)}
			onMouseDown={startHold}
			onMouseUp={cancelHold}
			onMouseLeave={cancelHold}
			onTouchStart={startHold}
			onTouchEnd={cancelHold}
		>
			{!confirmed && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0 bg-primary/20 transition-all"
					style={{
						width: `${progress * 100}%`,
						transition: holding ? "none" : "width 0.25s ease-out",
					}}
				/>
			)}
			<span className="relative z-10 flex items-center justify-center gap-2">
				{confirmed ? confirmedLabel : holding ? holdingLabel : label}
			</span>
		</button>
	);
}

export interface SmoothExpandProps {
	open: boolean;
	className?: string;
	children: ReactNode;
}

/** 平滑展开折叠：基于 CSS grid-template-rows 原生动画。 */
export function SmoothExpand({ open, className, children }: SmoothExpandProps) {
	const reduce = useReducedMotion();

	return (
		<div
			className={cn("grid transition-[grid-template-rows]", className)}
			style={{
				gridTemplateRows: open || reduce ? "1fr" : "0fr",
				transitionDuration: reduce ? "0s" : `${MOTION_DURATION.collapse}s`,
				transitionTimingFunction: MOTION_BEZIER.out,
			}}
		>
			<div className="overflow-hidden min-h-0">{children}</div>
		</div>
	);
}

export interface RevealProps {
	/** 动画延迟（秒） */
	delay?: number;
	className?: string;
}

/** 淡入：最克制的进场。 */
export function FadeIn({ delay = 0, className, children }: RevealProps & { children: ReactNode }) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });

	return (
		<div
			ref={ref}
			className={className}
			style={
				reduce
					? {}
					: {
							opacity: inView ? 1 : 0,
							transition: `opacity ${MOTION_DURATION.reveal}s ${MOTION_BEZIER.softOut} ${delay}s`,
						}
			}
		>
			{children}
		</div>
	);
}

export type SlideDirection = "up" | "down" | "left" | "right";

export interface SlideInProps extends RevealProps {
	direction?: SlideDirection;
}

/** 滑入：保留空间来源语义时使用。 */
export function SlideIn({
	direction = "up",
	delay = 0,
	className,
	children,
}: SlideInProps & { children: ReactNode }) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });

	const getTransform = () => {
		if (inView || reduce) return "translate3d(0, 0, 0)";
		switch (direction) {
			case "up":
				return "translate3d(0, 24px, 0)";
			case "down":
				return "translate3d(0, -24px, 0)";
			case "left":
				return "translate3d(24px, 0, 0)";
			case "right":
				return "translate3d(-24px, 0, 0)";
		}
	};

	return (
		<div
			ref={ref}
			className={className}
			style={
				reduce
					? {}
					: {
							opacity: inView ? 1 : 0,
							transform: getTransform(),
							transition: `opacity ${MOTION_DURATION.reveal}s ${MOTION_BEZIER.out} ${delay}s, transform ${MOTION_DURATION.reveal}s ${MOTION_BEZIER.out} ${delay}s`,
						}
			}
		>
			{children}
		</div>
	);
}
export interface TextUnderlineProps {
	/** 触发模式：hover 悬停生长（默认），reveal 视口进入生长 */
	mode?: "hover" | "reveal";
	color?: string;
	/** 线条粗细（像素，默认 1.5） */
	thickness?: number;
	className?: string;
	children: ReactNode;
}

/** 文字下划线：墨线自左向右平滑生长延伸。 */
export function TextUnderline({
	mode = "hover",
	color = "var(--primary)",
	thickness = 1.5,
	className,
	children,
}: TextUnderlineProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const [hovered, setHovered] = useState(false);

	const active = mode === "hover" ? hovered : inView;

	return (
		<span
			ref={ref}
			className={cn("relative inline-block cursor-pointer select-none", className)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{children}
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-0 left-0 right-0 origin-left"
				style={{
					height: `${thickness}px`,
					backgroundColor: color,
					transform: active || reduce ? "scaleX(1)" : "scaleX(0)",
					transition: reduce ? "none" : `transform 0.28s ${MOTION_BEZIER.out}`,
				}}
			/>
		</span>
	);
}

const WAVE_SVG_MASK =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 6'%3E%3Cpath d='M0 3 Q4 0.5, 8 3 T 16 3' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")";

export interface WavyUnderlineProps {
	/** 触发模式：hover 悬停显现（默认），always 常驻，reveal 视口进入生长 */
	mode?: "hover" | "always" | "reveal";
	/** 悬停时是否流动微澜（默认 true） */
	flow?: boolean;
	/** 波浪颜色（默认 var(--primary)） */
	color?: string;
	className?: string;
	children: ReactNode;
}

/** 波浪下划线：书卷批注意象，支持悬停流水微澜与视口生长。 */
export function WavyUnderline({
	mode = "hover",
	flow = true,
	color = "var(--primary)",
	className,
	children,
}: WavyUnderlineProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const [hovered, setHovered] = useState(false);

	const active = mode === "always" || (mode === "hover" ? hovered : inView);

	return (
		<span
			ref={ref}
			className={cn("relative inline-block cursor-pointer select-none", className)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{children}
			<span
				aria-hidden
				className="pointer-events-none absolute -bottom-1.5 left-0 right-0 h-1.5 origin-left"
				style={{
					backgroundColor: color,
					maskImage: WAVE_SVG_MASK,
					WebkitMaskImage: WAVE_SVG_MASK,
					maskRepeat: "repeat-x",
					WebkitMaskRepeat: "repeat-x",
					maskSize: "16px 6px",
					WebkitMaskSize: "16px 6px",
					transform: active || reduce ? "scaleX(1)" : "scaleX(0)",
					transition: reduce ? "none" : `transform 0.28s ${MOTION_BEZIER.out}`,
					animation:
						flow && active && !reduce ? "wave-flow 1.2s linear infinite" : "none",
				}}
			/>
		</span>
	);
}

export interface QuoteLineProps {
	color?: string;
	citation?: string;
	className?: string;
	children: ReactNode;
}

/** 引用线：左侧墨脊自上至下平滑注入生长。 */
export function QuoteLine({
	color = "var(--primary)",
	citation,
	className,
	children,
}: QuoteLineProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLQuoteElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });

	return (
		<blockquote
			ref={ref}
			className={cn(
				"relative my-2 pl-4 py-1 text-sm text-foreground/90 font-serif leading-relaxed",
				className,
			)}
		>
			<span
				aria-hidden
				className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 origin-top rounded-full"
				style={{
					backgroundColor: color,
					transform: inView || reduce ? "scaleY(1)" : "scaleY(0)",
					transition: reduce ? "none" : `transform 0.45s ${MOTION_BEZIER.out}`,
				}}
			/>
			<div
				style={{
					opacity: inView || reduce ? 1 : 0,
					transform: inView || reduce ? "translate3d(0, 0, 0)" : "translate3d(6px, 0, 0)",
					transition: reduce
						? "none"
						: `opacity 0.4s ${MOTION_BEZIER.softOut} 0.12s, transform 0.4s ${MOTION_BEZIER.out} 0.12s`,
				}}
			>
				{children}
				{citation && (
					<footer className="mt-1.5 font-mono text-[11px] text-muted-foreground not-italic">
						—— {citation}
					</footer>
				)}
			</div>
		</blockquote>
	);
}
/** 缩放入座：自 0.94 微缩落座，适合卡片与插图。 */
export function ScaleIn({ delay = 0, className, children }: RevealProps & { children: ReactNode }) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });

	return (
		<div
			ref={ref}
			className={className}
			style={
				reduce
					? {}
					: {
							opacity: inView ? 1 : 0,
							transform: inView ? "scale(1)" : "scale(0.94)",
							transition: `opacity ${MOTION_DURATION.reveal}s ${MOTION_BEZIER.out} ${delay}s, transform ${MOTION_DURATION.reveal}s ${MOTION_BEZIER.out} ${delay}s`,
						}
			}
		>
			{children}
		</div>
	);
}

export interface TextRevealProps {
	text: string;
	/** 首词延迟（秒） */
	delay?: number;
	className?: string;
}

/** 逐词揭示：文字自下方依序浮现。 */
export function TextReveal({ text, delay = 0, className }: TextRevealProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const words = text.split(" ");

	return (
		<span ref={ref} className={cn("inline-flex flex-wrap gap-x-1.5", className)}>
			{words.map((word, index) => {
				const wordDelay = delay + index * 0.06;
				return (
					<span key={`${word}-${index}`} className="inline-block overflow-hidden py-0.5">
						<span
							className="inline-block"
							style={
								reduce
									? {}
									: {
											opacity: inView ? 1 : 0,
											transform: inView
												? "translate3d(0, 0, 0)"
												: "translate3d(0, 100%, 0)",
											transition: `opacity 0.45s ${MOTION_BEZIER.out} ${wordDelay}s, transform 0.45s ${MOTION_BEZIER.out} ${wordDelay}s`,
										}
							}
						>
							{word}
						</span>
					</span>
				);
			})}
		</span>
	);
}

export interface StaggerGroupProps {
	className?: string;
	children: ReactNode;
}

/** 级联容器：为子级提供依序入场节奏。 */
export function StaggerGroup({ className, children }: StaggerGroupProps) {
	return <div className={className}>{children}</div>;
}

export interface StaggerItemProps {
	/** 在级联序列中的序号（从 0 开始） */
	index?: number;
	className?: string;
	children: ReactNode;
}

/** 级联容器的子项：根据 index 阶梯延迟进入。 */
export function StaggerItem({ index = 0, className, children }: StaggerItemProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const delay = index * 0.08;

	return (
		<div
			ref={ref}
			className={className}
			style={
				reduce
					? {}
					: {
							opacity: inView ? 1 : 0,
							transform: inView ? "translate3d(0, 0, 0)" : "translate3d(0, 14px, 0)",
							transition: `opacity 0.4s ${MOTION_BEZIER.out} ${delay}s, transform 0.4s ${MOTION_BEZIER.out} ${delay}s`,
						}
			}
		>
			{children}
		</div>
	);
}

export interface NumberFlowProps {
	/** 目标数值（整数，千分位展示） */
	value: number;
	/** 滚动动画时长（秒，默认 1.2） */
	duration?: number;
	className?: string;
}

/** 数字滚动：数值变化时通过 requestAnimationFrame 缓动滚动到新值。 */
export function NumberFlow({ value, duration = 1.2, className }: NumberFlowProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const [displayValue, setDisplayValue] = useState(0);
	const currentValRef = useRef(0);

	useEffect(() => {
		if (!inView) return undefined;
		if (reduce) {
			currentValRef.current = value;
			setDisplayValue(value);
			return undefined;
		}

		let frameId: number;
		const startTime = performance.now();
		const startValue = currentValRef.current;
		const diff = value - startValue;

		const animate = (currentTime: number) => {
			const elapsed = (currentTime - startTime) / 1000;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			const nextVal = Math.round(startValue + diff * eased);
			currentValRef.current = nextVal;
			setDisplayValue(nextVal);

			if (progress < 1) {
				frameId = requestAnimationFrame(animate);
			}
		};

		frameId = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(frameId);
	}, [inView, value, duration, reduce]);

	return (
		<span ref={ref} className={cn("tabular-nums", className)}>
			{displayValue.toLocaleString()}
		</span>
	);
}

export interface ShineProps {
	/** 扫光周期（秒） */
	interval?: number;
	color?: string;
	className?: string;
	children: ReactNode;
}

/** 扫光：高光条周期性斜掠过容器，用于勋章、封面与强调卡。 */
export function Shine({
	interval = 3,
	color = "rgba(255, 255, 255, 0.4)",
	className,
	children,
}: ShineProps & { children: ReactNode }) {
	const reduce = useReducedMotion();

	return (
		<div className={cn("relative overflow-hidden", className)}>
			{children}
			{!reduce && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						background: `linear-gradient(105deg, transparent 35%, ${color} 50%, transparent 65%)`,
						animation: `shine-sweep ${interval}s ease-in-out infinite`,
					}}
				/>
			)}
		</div>
	);
}

export interface BorderBeamProps {
	/** 流光旋转周期（秒，默认 4） */
	duration?: number;
	color?: string;
	className?: string;
	children: ReactNode;
}

/** 流光边框：纯 CSS 光斑沿边框环绕，用于焦点态与特性卡。 */
export function BorderBeam({
	duration = 4,
	color = "var(--primary)",
	className,
	children,
}: BorderBeamProps & { children: ReactNode }) {
	const reduce = useReducedMotion();

	return (
		<div className={cn("relative overflow-hidden rounded-xl p-px", className)}>
			{!reduce && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-[-100%]"
					style={{
						background: `conic-gradient(from 0deg, transparent 0turn 0.88turn, ${color} 1turn)`,
						animation: `border-beam-spin ${duration}s linear infinite`,
					}}
				/>
			)}
			<div className="relative rounded-[calc(0.75rem-1px)] bg-card">{children}</div>
		</div>
	);
}

export interface CopyButtonProps {
	text: string;
	onCopy?: () => void;
	className?: string;
}

/** 就地复制按钮：点击时图标与状态平滑形变，就地确认。 */
export function CopyButton({ text, onCopy, className }: CopyButtonProps) {
	const reduce = useReducedMotion();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			}
		} catch {
			// 剪贴板不可用时降级
		}
		setCopied(true);
		onCopy?.();
		setTimeout(() => setCopied(false), 1800);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label={copied ? "已复制" : "复制"}
			className={cn(
				"relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-200 active:scale-95",
				copied
					? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					: "border-border/40 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
				className,
			)}
		>
			<span
				className={cn(
					"inline-flex transition-transform duration-200",
					reduce ? "" : copied ? "rotate-0 scale-100" : "scale-100",
				)}
			>
				{copied ? <Check size={14} className="stroke-[2.5]" /> : <Copy size={14} />}
			</span>
			<span>{copied ? "已复制" : "点击复制"}</span>
		</button>
	);
}

export interface HoverLiftProps {
	className?: string;
	children: ReactNode;
}

/** 纸面微浮卡片：克制上浮 2px 并淡出软影，坚守无缩放底线。 */
export function HoverLift({ className, children }: HoverLiftProps) {
	const reduce = useReducedMotion();

	return (
		<div
			className={cn(
				"rounded-xl border border-border/40 bg-card transition-all select-none",
				reduce
					? ""
					: "hover:-translate-y-0.5 hover:border-border/80 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] duration-200 ease-out",
				className,
			)}
		>
			{children}
		</div>
	);
}

export interface CounterBadgeProps {
	count: number;
	className?: string;
}

/** 计数微弹气泡：数值增减时触发微弹入场动画。 */
export function CounterBadge({ count, className }: CounterBadgeProps) {
	const reduce = useReducedMotion();

	return (
		<span
			key={count}
			className={cn(
				"inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary",
				reduce ? "" : "animate-in fade-in-50 zoom-in-95 duration-200 ease-out",
				className,
			)}
		>
			{count}
		</span>
	);
}
