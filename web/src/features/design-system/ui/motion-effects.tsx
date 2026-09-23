/**
 * @fileoverview 动效效果库：可复用的 motion 动画原语（动效章程画廊的资产层）。
 *
 * 全部效果默认进入视口时触发一次（whileInView + once），任何新组件
 * 直接取用包裹即可获得该动效；参数出处 @shared/lib/motion。
 */

import { MOTION_DURATION, MOTION_EASE, revealTransition } from "@shared/lib/motion";
import { cn } from "@shared/lib/utils";
import {
	animate,
	motion,
	useInView,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";

/** 进入视口触发一次的公共属性。 */
interface RevealProps {
	/** 动画延迟（秒） */
	delay?: number;
	/** 包裹层类名 */
	className?: string;
}

/** 淡入：最克制的进场。 */
export function FadeIn({ delay = 0, className, children }: RevealProps & { children: ReactNode }) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0 }}
			whileInView={{ opacity: 1 }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ duration: MOTION_DURATION.reveal, ease: MOTION_EASE.softOut, delay }}
		>
			{children}
		</motion.div>
	);
}

/** 滑入方向。 */
type SlideDirection = "up" | "down" | "left" | "right";

/** 滑入隐藏态坐标：方向决定位移轴。 */
const SLIDE_HIDDEN: Record<SlideDirection, { opacity: number; x?: number; y?: number }> = {
	up: { opacity: 0, y: 24 },
	down: { opacity: 0, y: -24 },
	left: { opacity: 0, x: 24 },
	right: { opacity: 0, x: -24 },
};

export interface SlideInProps extends RevealProps {
	/** 滑入方向：up 表示自下方滑入 */
	direction?: SlideDirection;
}

/** 滑入：方向性进场，保留空间语义时使用。 */
export function SlideIn({
	direction = "up",
	delay = 0,
	className,
	children,
}: SlideInProps & { children: ReactNode }) {
	return (
		<motion.div
			className={className}
			initial={SLIDE_HIDDEN[direction]}
			whileInView={{ opacity: 1, x: 0, y: 0 }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ ...revealTransition, delay }}
		>
			{children}
		</motion.div>
	);
}

/** 模糊聚焦：内容自虚化对焦，适合标题与主视觉。 */
export function BlurIn({ delay = 0, className, children }: RevealProps & { children: ReactNode }) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, filter: "blur(8px)" }}
			whileInView={{ opacity: 1, filter: "blur(0px)" }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ duration: MOTION_DURATION.reveal, ease: MOTION_EASE.softOut, delay }}
		>
			{children}
		</motion.div>
	);
}

/** 缩放入座：自 0.92 微缩落座，适合卡片与插图。 */
export function ScaleIn({ delay = 0, className, children }: RevealProps & { children: ReactNode }) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, scale: 0.92 }}
			whileInView={{ opacity: 1, scale: 1 }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ duration: MOTION_DURATION.reveal, ease: MOTION_EASE.out, delay }}
		>
			{children}
		</motion.div>
	);
}

export interface TextRevealProps {
	/** 要逐词揭示的文本 */
	text: string;
	/** 首词延迟（秒） */
	delay?: number;
	/** 容器类名 */
	className?: string;
}

/** 逐词揭示：文字自下方依序浮现，标题动效的招牌。 */
export function TextReveal({ text, delay = 0, className }: TextRevealProps) {
	const words = text.split(" ");

	return (
		<motion.span
			className={cn("inline", className)}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-40px" }}
			transition={{ staggerChildren: 0.06, delayChildren: delay }}
		>
			{words.map((word, index) => (
				<motion.span
					className="inline-block"
					key={`${word}-${index}`}
					variants={{
						hidden: { opacity: 0, y: "0.9em" },
						visible: { opacity: 1, y: "0em" },
					}}
					transition={{ duration: 0.5, ease: MOTION_EASE.out }}
				>
					{word}
					{index < words.length - 1 ? "\u00A0" : ""}
				</motion.span>
			))}
		</motion.span>
	);
}

/** 级联容器的子项：配合 StaggerGroup 使用。 */
export function StaggerItem({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<motion.div
			className={className}
			variants={{
				hidden: { opacity: 0, y: 12 },
				visible: { opacity: 1, y: 0 },
			}}
			transition={{ duration: 0.4, ease: MOTION_EASE.out }}
		>
			{children}
		</motion.div>
	);
}

/** 级联容器：直接子级 StaggerItem 依序进入，列表与卡组的编排动效。 */
export function StaggerGroup({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<motion.div
			className={className}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-40px" }}
			variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
		>
			{children}
		</motion.div>
	);
}

export interface NumberFlowProps {
	/** 目标数值（整数，渲染时千分位分组） */
	value: number;
	/** 滚动时长（秒） */
	duration?: number;
	/** 类名 */
	className?: string;
}

/** 数字滚动：数值变化时滚动到新值；等宽数字防宽度抖动。 */
export function NumberFlow({ value, duration = 1.2, className }: NumberFlowProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const count = useMotionValue(0);
	const text = useTransform(count, (v) => Math.round(v).toLocaleString());

	useEffect(() => {
		if (!inView) return undefined;
		if (reduce) {
			count.set(value);
			return undefined;
		}
		const controls = animate(count, value, { duration, ease: MOTION_EASE.out });
		return () => controls.stop();
	}, [count, inView, value, duration, reduce]);

	return (
		<span ref={ref} className={cn("tabular-nums", className)}>
			<motion.span>{text}</motion.span>
		</span>
	);
}

export interface ShineProps {
	/** 扫光周期（秒，含停顿） */
	interval?: number;
	/** 高光颜色（任意 CSS 颜色） */
	color?: string;
	/** 包裹层类名 */
	className?: string;
}

/** 扫光：高光条周期性掠过容器，用于勋章、封面、强调卡。 */
export function Shine({
	interval = 3,
	color = "rgba(255,255,255,0.45)",
	className,
	children,
}: ShineProps & { children: ReactNode }) {
	return (
		<div className={cn("relative overflow-hidden", className)}>
			{children}
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<motion.div
					className="absolute inset-y-0 w-1/3"
					style={{
						background: `linear-gradient(105deg, transparent, ${color}, transparent)`,
					}}
					initial={{ x: "-140%" }}
					animate={{ x: "420%" }}
					transition={{
						duration: interval * 0.55,
						repeat: Infinity,
						repeatDelay: interval * 0.45,
						ease: "easeInOut",
					}}
				/>
			</div>
		</div>
	);
}

export interface BorderBeamProps {
	/** 流光旋转周期（秒） */
	duration?: number;
	/** 光斑颜色（任意 CSS 颜色） */
	color?: string;
	/** 包裹层类名 */
	className?: string;
}

/** 流光边框：一道光斑沿边框环绕，用于焦点态与特性卡。 */
export function BorderBeam({
	duration = 4,
	color = "var(--brand)",
	className,
	children,
}: BorderBeamProps & { children: ReactNode }) {
	return (
		<div className={cn("relative overflow-hidden rounded-xl p-px", className)}>
			<motion.div
				aria-hidden
				className="absolute inset-[-100%]"
				style={{
					background: `conic-gradient(from 0deg, transparent 0turn 0.88turn, ${color} 1turn)`,
				}}
				animate={{ rotate: 360 }}
				transition={{ duration, repeat: Infinity, ease: "linear" }}
			/>
			<div className="relative rounded-[calc(0.75rem-1px)] bg-card">{children}</div>
		</div>
	);
}

export interface MagneticProps {
	/** 磁吸强度（0~1，指针偏移的跟随比例） */
	strength?: number;
	/** 包裹层类名 */
	className?: string;
}

/** 磁吸：内容向指针方向弹性跟随，用于主要操作按钮。 */
export function Magnetic({
	strength = 0.25,
	className,
	children,
}: MagneticProps & { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const springX = useSpring(x, { stiffness: 260, damping: 20 });
	const springY = useSpring(y, { stiffness: 260, damping: 20 });

	return (
		<motion.div
			ref={ref}
			className={cn("inline-block", className)}
			style={{ x: springX, y: springY }}
			onMouseMove={(event) => {
				const rect = ref.current?.getBoundingClientRect();
				if (!rect) return;
				x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
				y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
			}}
			onMouseLeave={() => {
				x.set(0);
				y.set(0);
			}}
		>
			{children}
		</motion.div>
	);
}
