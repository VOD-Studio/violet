import { Modal, type ModalContentMotion } from "@shared/ui/modal";
import { X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useId } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 纸张轻盈落定动效：
 * 打开时如手稿自空中轻柔飘落归正（微下沉浮定），
 * 关闭时如被轻快移开掠起，温润从容，不产生眩晕拉伸。
 */
const PAPER_DIALOG_MOTION: ModalContentMotion = {
	initial: {
		opacity: 0,
		scale: 0.98,
		y: -16,
	},
	animate: {
		opacity: 1,
		scale: 1,
		y: 0,
	},
	exit: {
		opacity: 0,
		scale: 0.985,
		y: -10,
	},
	transition: {
		duration: 0.24,
		ease: [0.16, 1, 0.3, 1],
	},
};

const REDUCED_DIALOG_MOTION: ModalContentMotion = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.12 },
};

export interface PaperDialogProps {
	/** 受控打开状态 */
	open: boolean;
	/** 开关状态变更回调 */
	onOpenChange: (open: boolean) => void;
	/** 辅助功能标题（仅供屏幕阅读器），默认 "纸面便笺" */
	titleSrOnly?: string;
	/** 是否显示右上角关闭按钮，默认 true */
	showCloseButton?: boolean;
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
 * 仅提供拟真手撕纯白/暗夜毛边、立体漫反射纸影与纸张飘落落平动效，
 * 不对正文内部做任何过度业务封装，内容与头部完全交由调用方自主排布。
 */
export function PaperDialog({
	open,
	onOpenChange,
	titleSrOnly = "纸面便笺",
	showCloseButton = true,
	className,
	contentClassName,
	children,
}: PaperDialogProps) {
	const reduceMotion = useReducedMotion();
	const filterId = useId().replace(/:/g, "-");
	const fullFilterId = `paper-deckle-${filterId}`;

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			unstyled
			scrollable={false}
			titleSrOnly
			title={titleSrOnly}
			showCloseButton={false}
			contentMotion={reduceMotion ? REDUCED_DIALOG_MOTION : PAPER_DIALOG_MOTION}
			className={cn(
				"isolate h-[min(56rem,calc(100dvh-2.5rem))] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-visible bg-transparent shadow-none sm:w-[calc(100vw-3rem)] xl:max-w-7xl",
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
				{/* 浮动关闭按钮：优雅放置于右上角，不破坏内部自定义排版 */}
				{showCloseButton && (
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						aria-label="关闭"
						className="absolute top-5 right-5 z-20 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary sm:top-6 sm:right-8"
					>
						<X className="size-4" />
					</button>
				)}

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
