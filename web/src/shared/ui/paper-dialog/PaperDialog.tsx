import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "@/shared/lib/utils";

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
 * 独立基于 Radix Dialog 与 motion 构建，与共享 Modal 零耦合：
 * 原版 Modal 的居中 transform 会与动效属性冲突、且强加宽度/圆角/裁切，
 * 故此处用视口 Flex 层居中，纸张样式完全自治。
 *
 * 动效为宽版报纸对折摊开：展开自中缝向两翼减速铺平（300ms），
 * 收拢顺势加速向内折合并利落淡出（200ms）。
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
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AnimatePresence>
				{open && (
					<DialogPrimitive.Portal forceMount>
						{/* 遮罩：渐入渐出 */}
						<DialogPrimitive.Overlay asChild forceMount>
							<motion.div
								className="fixed inset-0 z-50 bg-black/50"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
						</DialogPrimitive.Overlay>

						{/* 全屏视口 Flex 居中层：零 transform 冲突 */}
						<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
							<DialogPrimitive.Content asChild forceMount>
								<motion.div
									className={cn(
										"pointer-events-auto relative isolate flex h-[min(56rem,calc(100dvh-2.5rem))] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-visible bg-transparent shadow-none outline-none sm:w-[calc(100vw-3rem)] xl:max-w-7xl",
										className,
									)}
									initial={
										reduceMotion
											? { opacity: 0 }
											: { opacity: 0, scaleX: 0.2, scaleY: 0.98 }
									}
									animate={{
										opacity: 1,
										scaleX: 1,
										scaleY: 1,
										transition: {
											duration: 0.3,
											ease: [0.16, 1, 0.3, 1],
											opacity: { duration: 0.15, ease: "easeOut" },
										},
									}}
									exit={
										reduceMotion
											? { opacity: 0 }
											: {
													opacity: 0,
													scaleX: 0.22,
													scaleY: 0.98,
													transition: {
														duration: 0.2,
														ease: [0.4, 0, 0.9, 0.2],
														opacity: { duration: 0.14, ease: "easeIn" },
													},
												}
									}
								>
									{/* 屏幕阅读器可访问标题 */}
									<DialogPrimitive.Title className="sr-only">
										{titleSrOnly}
									</DialogPrimitive.Title>

									{/* 细微手撕纸毛边滤镜（实例唯一 ID 隔离） */}
									<svg
										aria-hidden="true"
										className="pointer-events-none absolute size-0"
									>
										<filter
											id={fullFilterId}
											x="-5%"
											y="-5%"
											width="110%"
											height="110%"
										>
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
										{showCloseButton && (
											<DialogPrimitive.Close
												aria-label="关闭"
												className="absolute top-5 right-5 z-20 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary sm:top-6 sm:right-8"
											>
												<X className="size-4" />
											</DialogPrimitive.Close>
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
								</motion.div>
							</DialogPrimitive.Content>
						</div>
					</DialogPrimitive.Portal>
				)}
			</AnimatePresence>
		</DialogPrimitive.Root>
	);
}
