import { Modal, type ModalContentMotion } from "@shared/ui/modal";
import { X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useId } from "react";
import { cn } from "@/shared/lib/utils";

const PAPER_DIALOG_MOTION: ModalContentMotion = {
	initial: {
		opacity: 0,
		y: -16,
		scale: 0.96,
	},
	animate: {
		opacity: 1,
		y: 0,
		scale: 1,
	},
	exit: {
		opacity: 0,
		y: 12,
		scale: 0.97,
		transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
	},
	transition: {
		duration: 0.36,
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
	/** 弹窗主标题 */
	title?: ReactNode;
	/** 报耳/期号微标，如 "VIOLET CODEX · FOLIO 01" */
	folio?: ReactNode;
	/** 副标题或简要说明 */
	description?: ReactNode;
	/** 红色印鉴文案，如 "SPEC · 准" / "DRAFT"，省略时不渲染印章 */
	seal?: ReactNode;
	/** 头部操作区（如独立页外链、操作按钮组等） */
	actions?: ReactNode;
	/** 是否显示右上角关闭按钮，默认 true */
	showCloseButton?: boolean;
	/** 主体内容节点 */
	children?: ReactNode;
	/** 弹窗外层容器类名（可覆盖最大宽度与高度） */
	className?: string;
	/** 内容可滚动区域容器类名 */
	contentClassName?: string;
}

/**
 * PaperDialog: 纯白手撕毛边纸质弹窗公共组件
 *
 * 拟真手稿手撕边缘（Deckle Edge），白底无黑描边，
 * 配合双层微错位叠放与自然立体漫反射软影，呈现大开本舒展质感。
 */
export function PaperDialog({
	open,
	onOpenChange,
	title,
	folio,
	description,
	seal,
	actions,
	showCloseButton = true,
	children,
	className,
	contentClassName,
}: PaperDialogProps) {
	const reduceMotion = useReducedMotion();
	const filterId = useId().replace(/:/g, "-");
	const fullFilterId = `paper-deckle-${filterId}`;
	const titleText = typeof title === "string" ? title : "纸面便笺";

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			unstyled
			scrollable={false}
			titleSrOnly
			title={titleText}
			showCloseButton={false}
			contentMotion={reduceMotion ? REDUCED_DIALOG_MOTION : PAPER_DIALOG_MOTION}
			className={cn(
				"isolate h-[min(56rem,calc(100dvh-2.5rem))] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-visible bg-transparent shadow-none sm:w-[calc(100vw-3rem)] xl:max-w-7xl",
				className,
			)}
		>
			{/* 粗糙手撕纸毛边滤镜：使用实例唯一 ID 隔离 */}
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

			{/* 底层微错位纸影：微偏 0.6deg，营造实体多层叠放厚度 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 -rotate-[0.6deg] bg-black/10 dark:bg-white/10"
				style={{ filter: `url(#${fullFilterId})` }}
			/>

			{/* 表层主手撕纸：纯白底色无描边，边缘为纯纸张纤维手撕毛边 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 bg-card shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)]"
				style={{ filter: `url(#${fullFilterId})` }}
			/>

			{/* 纸面正文区：独立前景层，文字清晰锋利，事件不受滤镜干扰 */}
			<div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden text-foreground">
				{(title || folio || seal || actions || showCloseButton) && (
					<header className="relative flex min-h-16 items-center border-b border-border/80 px-6 sm:px-10">
						<div className="flex min-w-0 flex-1 items-center gap-4">
							{seal && (
								<div
									aria-hidden="true"
									className="select-none -rotate-2 rounded-[2px] border border-red-600/80 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-red-600 uppercase shadow-[0_0_0_1px_rgba(220,38,38,0.12)] dark:border-red-400/80 dark:text-red-400"
								>
									{seal}
								</div>
							)}

							<div className="min-w-0">
								{folio && (
									<div className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
										{folio}
									</div>
								)}
								{title && (
									<h2 className="mt-0.5 truncate font-serif text-xs text-muted-foreground sm:text-sm">
										{title}
									</h2>
								)}
								{description && (
									<p className="mt-0.5 truncate font-serif text-xs text-muted-foreground">
										{description}
									</p>
								)}
							</div>
						</div>

						<div className="flex items-center gap-3">
							{showCloseButton && (
								<button
									type="button"
									onClick={() => onOpenChange(false)}
									aria-label="关闭"
									className="inline-flex size-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									<X className="size-4" />
								</button>
							)}
						</div>
					</header>
				)}

				<div
					className={cn(
						"relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-10 sm:py-10",
						contentClassName,
					)}
				>
					{children}
				</div>
			</div>
		</Modal>
	);
}
