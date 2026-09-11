import { Modal, type ModalContentMotion } from "@shared/ui/modal";
import { X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/shared/lib/utils";

/** 纸张物理动效预设枚举 */
export type PaperMotionVariant = "rollout" | "spread" | "extract" | "peel";

/** 四种截然不同维度的纸张物理动效库 */
export const PAPER_MOTION_VARIANTS: Record<PaperMotionVariant, ModalContentMotion> = {
	/** 方案 1：工程图纸 / 卷轴纵向滚开展平（Blueprint Rollout） */
	rollout: {
		initial: {
			opacity: 0,
			clipPath: "inset(0 0 100% 0)",
			y: -20,
		},
		animate: {
			opacity: 1,
			clipPath: "inset(0 0 0% 0)",
			y: 0,
		},
		exit: {
			opacity: 0,
			clipPath: "inset(0 0 100% 0)",
			y: -14,
		},
		transition: {
			duration: 0.36,
			ease: [0.16, 1, 0.3, 1],
		},
	},

	/** 方案 2：宽版报纸对折中缝横向摊开（Broadsheet Fold Spread） */
	spread: {
		initial: {
			opacity: 0,
			clipPath: "inset(0 50% 0 50%)",
			scaleX: 0.88,
		},
		animate: {
			opacity: 1,
			clipPath: "inset(0 0% 0 0%)",
			scaleX: 1,
		},
		exit: {
			opacity: 0,
			clipPath: "inset(0 50% 0 50%)",
			scaleX: 0.9,
		},
		transition: {
			duration: 0.34,
			ease: [0.16, 1, 0.3, 1],
		},
	},

	/** 方案 3：公文封套平滑向上抽拔入位（Portfolio Extract） */
	extract: {
		initial: {
			opacity: 0,
			y: 64,
			scale: 0.98,
		},
		animate: {
			opacity: 1,
			y: 0,
			scale: 1,
		},
		exit: {
			opacity: 0,
			y: 40,
			scale: 0.99,
		},
		transition: {
			type: "spring",
			stiffness: 240,
			damping: 25,
			mass: 0.85,
		},
	},

	/** 方案 4：手账对角翻掀展开（Diagonal Corner Peel） */
	peel: {
		initial: {
			opacity: 0,
			clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)",
			rotate: -1.6,
			scale: 0.96,
		},
		animate: {
			opacity: 1,
			clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
			rotate: 0,
			scale: 1,
		},
		exit: {
			opacity: 0,
			clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)",
			rotate: 1.2,
			scale: 0.97,
		},
		transition: {
			duration: 0.38,
			ease: [0.16, 1, 0.3, 1],
		},
	},
};

const REDUCED_DIALOG_MOTION: ModalContentMotion = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.12 },
};

const MOTION_PRESET_OPTIONS: Array<{ id: PaperMotionVariant; label: string }> = [
	{ id: "rollout", label: "1. 卷轴舒展" },
	{ id: "spread", label: "2. 报纸摊开" },
	{ id: "extract", label: "3. 封套抽拔" },
	{ id: "peel", label: "4. 对角翻掀" },
];

export interface PaperDialogProps {
	/** 受控打开状态 */
	open: boolean;
	/** 开关状态变更回调 */
	onOpenChange: (open: boolean) => void;
	/** 辅助功能标题（仅供屏幕阅读器），默认 "纸面便笺" */
	titleSrOnly?: string;
	/** 是否显示右上角关闭按钮，默认 true */
	showCloseButton?: boolean;
	/** 动效预设，默认 'rollout'（卷轴展开） */
	motionVariant?: PaperMotionVariant;
	/** 是否展示动效快速演练切换器（方便视觉评审），默认 true */
	showMotionSwitcher?: boolean;
	/** 弹窗外层容器类名（可覆盖宽度与自适应尺寸） */
	className?: string;
	/** 内部纸面滚动内容区类名 */
	contentClassName?: string;
	/** 纸面主体内容（完全由调用方自由排版，外层不强加任何固定信头与线条） */
	children?: ReactNode;
}

/**
 * PaperDialog: 纯粹的手撕毛边纸张外壳容器
 *
 * 仅提供拟真手撕纯白/暗夜毛边、立体漫反射纸影与多种纸张物理动效预设，
 * 不对正文内部做任何过度业务封装，内容与头部完全交由调用方自主排布。
 */
export function PaperDialog({
	open,
	onOpenChange,
	titleSrOnly = "纸面便笺",
	showCloseButton = true,
	motionVariant = "rollout",
	showMotionSwitcher = true,
	className,
	contentClassName,
	children,
}: PaperDialogProps) {
	const reduceMotion = useReducedMotion();
	const filterId = useId().replace(/:/g, "-");
	const fullFilterId = `paper-deckle-${filterId}`;
	const [activeVariant, setActiveVariant] = useState<PaperMotionVariant>(motionVariant);
	// key 用于切换动效预设时强制触发展开动画重播
	const [playKey, setPlayKey] = useState(0);

	const selectedMotion = PAPER_MOTION_VARIANTS[activeVariant] ?? PAPER_MOTION_VARIANTS.rollout;

	const selectPreset = (nextVariant: PaperMotionVariant) => {
		setActiveVariant(nextVariant);
		setPlayKey((k) => k + 1);
	};

	return (
		<Modal
			key={playKey}
			open={open}
			onOpenChange={onOpenChange}
			unstyled
			scrollable={false}
			titleSrOnly
			title={titleSrOnly}
			showCloseButton={false}
			contentMotion={reduceMotion ? REDUCED_DIALOG_MOTION : selectedMotion}
			className={cn(
				"isolate h-[min(56rem,calc(100dvh-2.5rem))] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-visible bg-transparent shadow-none [perspective:1400px] sm:w-[calc(100vw-3rem)] xl:max-w-7xl",
				className,
			)}
		>
			{/* 细微手撕纸毛边滤镜 */}
			<svg aria-hidden="true" className="pointer-events-none absolute size-0">
				<filter id={fullFilterId} x="-5%" y="-5%" width="110%" height="110%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.04"
						numOctaves="4"
						seed="5"
						result="noise"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale="4.5"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
			</svg>

			{/* 底层微错位纸影：营造实体纸张叠放厚度 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 -rotate-[0.6deg] bg-black/10 dark:bg-white/10"
				style={{ filter: `url(#${fullFilterId})` }}
			/>

			{/* 表层主手撕纸：纯白底色无黑描边，立体漫反射软影 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 bg-card shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]"
				style={{ filter: `url(#${fullFilterId})` }}
			/>

			{/* 纸面内容区：不受任何滤镜影响，调用方独享整页空间 */}
			<div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden text-foreground">
				{/* 浮动操作栏：动效切换选择器 + 优雅关闭按钮 */}
				<div className="absolute top-4 right-5 z-20 flex items-center gap-2 sm:top-5 sm:right-8">
					{showMotionSwitcher && (
						<nav
							aria-label="纸张动效方案演练"
							className="flex items-center gap-0.5 rounded-full border border-border/80 bg-background/90 p-0.5 font-mono text-[10px] text-muted-foreground/80 shadow-xs backdrop-blur-md"
						>
							{MOTION_PRESET_OPTIONS.map((option) => {
								const active = activeVariant === option.id;
								return (
									<button
										key={option.id}
										type="button"
										onClick={() => selectPreset(option.id)}
										className={cn(
											"rounded-full px-2 py-0.5 transition-colors",
											active
												? "bg-primary font-semibold text-primary-foreground shadow-xs"
												: "hover:text-foreground",
										)}
									>
										{option.label}
									</button>
								);
							})}
						</nav>
					)}

					{showCloseButton && (
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							aria-label="关闭"
							className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
						>
							<X className="size-4" />
						</button>
					)}
				</div>

				<div
					className={cn(
						"relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 sm:p-10 lg:p-12",
						contentClassName,
					)}
				>
					{children}
				</div>
			</div>
		</Modal>
	);
}
