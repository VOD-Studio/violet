import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "@/shared/lib/utils";

/** 可滚动纸面弹窗的受控状态与内容插槽。 */
export interface PaperDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * 仅供屏幕阅读器的标题。
	 * @default "纸面便笺"
	 */
	titleSrOnly?: string;
	/**
	 * 是否显示右上角关闭按钮。
	 * @default true
	 */
	showCloseButton?: boolean;
	/** 弹窗外层容器类名（可覆盖宽度与自适应尺寸） */
	className?: string;
	/** 内部纸面滚动内容区类名 */
	contentClassName?: string;
	/** 纸面主体内容（完全由调用方自由排版，外层不强加任何固定信头与线条） */
	children?: ReactNode;
}

/** 四边手撕毛边纸面弹窗；装饰滤镜不影响正文与交互层。 */
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
						<DialogPrimitive.Overlay asChild forceMount>
							<motion.div
								className="fixed inset-0 z-50 bg-black/50"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
							/>
						</DialogPrimitive.Overlay>

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
									<DialogPrimitive.Title className="sr-only">
										{titleSrOnly}
									</DialogPrimitive.Title>

									{/* 不设 viewBox，让撕口始终以 CSS 像素计量，不随纸面尺寸拉伸。 */}
									<svg
										aria-hidden="true"
										focusable="false"
										className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible text-card drop-shadow-[0_12px_20px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
									>
										<defs>
											<filter
												id={fullFilterId}
												x="-10%"
												y="-10%"
												width="120%"
												height="120%"
												colorInterpolationFilters="sRGB"
											>
												<feTurbulence
													type="fractalNoise"
													baseFrequency="0.025 0.04"
													numOctaves="2"
													seed="5"
													result="tear"
												/>
												<feDisplacementMap
													in="SourceGraphic"
													in2="tear"
													scale="8"
													xChannelSelector="R"
													yChannelSelector="G"
													result="tornPaper"
												/>
												<feTurbulence
													type="fractalNoise"
													baseFrequency="0.65"
													numOctaves="3"
													seed="17"
													result="fibers"
												/>
												<feDisplacementMap
													in="tornPaper"
													in2="fibers"
													scale="3"
													xChannelSelector="R"
													yChannelSelector="G"
												/>
											</filter>
										</defs>
										<rect
											width="100%"
											height="100%"
											fill="currentColor"
											filter={`url(#${fullFilterId})`}
										/>
									</svg>

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
