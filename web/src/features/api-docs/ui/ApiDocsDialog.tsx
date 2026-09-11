import { Modal, type ModalContentMotion } from "@shared/ui/modal";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { useApiDocsDialogStore } from "../model/store";
import { ApiReference } from "./ApiReference";

/** 键入序列彩蛋：非输入态下连敲 a-p-i 唤出纸弹窗 */
const EASTER_EGG_SEQUENCE = "api";
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
/** 在前台以手撕粗糙炭墨毛边纸呈现实时 API 参考文档。 */
export function ApiDocsDialog() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const close = useApiDocsDialogStore((s) => s.close);
	const open = useApiDocsDialogStore((s) => s.open);
	const reduceMotion = useReducedMotion();

	useEasterEgg(open);

	return (
		<Modal
			open={isOpen}
			onOpenChange={(next) => (next ? open() : close())}
			unstyled
			scrollable={false}
			titleSrOnly
			title="API 文档"
			showCloseButton={false}
			contentMotion={reduceMotion ? REDUCED_DIALOG_MOTION : PAPER_DIALOG_MOTION}
			className="isolate h-[min(56rem,calc(100dvh-2.5rem))] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-1.5rem)] max-w-6xl overflow-visible bg-transparent shadow-none sm:w-[calc(100vw-3rem)] xl:max-w-7xl"
		>
			{/* 粗糙手撕炭墨毛边滤镜：细频噪点微位移，完美还原木刻素描手撕残边 */}
			<svg aria-hidden="true" className="pointer-events-none absolute size-0">
				<filter id="violet-rough-paper-edge" x="-5%" y="-5%" width="110%" height="110%">
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

			{/* 底层错位撕纸衬纸：无黑框，微偏 0.6deg，营造实体纸张多层叠放厚度 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 -rotate-[0.6deg] bg-muted/40 dark:bg-card/40"
				style={{ filter: "url(#violet-rough-paper-edge)" }}
			/>

			{/* 表层主手撕白纸：纯白无黑描边（绝无土黄、绝无黑框），纯纸张纤维手撕毛边与立体漫反射阴影 */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-0 bg-card shadow-[0_4px_16px_rgba(0,0,0,0.06),0_24px_64px_-16px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)]"
				style={{ filter: "url(#violet-rough-paper-edge)" }}
			/>
			{/* 纸面内容区：不受任何滤镜影响，文字清晰，交互灵敏 */}
			<div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden text-foreground">
				{/* 信头报耳与关闭操作 */}
				<header className="relative flex min-h-16 items-center border-b border-border/80 px-6 sm:px-10">
					<div className="flex min-w-0 flex-1 items-center gap-4">
						{/* 朱砂红墨印章 */}
						<div
							aria-hidden="true"
							className="select-none -rotate-2 rounded-[2px] border border-red-600/80 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-red-600 uppercase shadow-[0_0_0_1px_rgba(220,38,38,0.12)] dark:border-red-400/80 dark:text-red-400"
						>
							SPEC · 准
						</div>

						<div className="min-w-0">
							<div className="flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
								<span>VIOLET CODEX</span>
								<span className="text-muted-foreground/40">·</span>
								<span className="font-bold text-foreground">
									FOLIO 01 / 接口手卷
								</span>
							</div>
							<p className="mt-0.5 truncate font-serif text-xs text-muted-foreground">
								全栈实时接口契约便笺 · 与线上代码版本同步
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Link
							to="/docs"
							onClick={close}
							className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border/80 bg-background/60 px-3 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<span>独立大页</span>
							<ArrowUpRight className="size-3.5" />
						</Link>

						<button
							type="button"
							onClick={close}
							aria-label="关闭"
							className="inline-flex size-8 items-center justify-center rounded-sm border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<X className="size-4" />
						</button>
					</div>
				</header>

				{/* 纸面正文区：舒展大开本 */}
				<div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-8 sm:px-10 sm:py-10">
					<ApiReference variant="dialog" />
				</div>
			</div>
		</Modal>
	);
}

/**
 * 键入序列监听：非输入态连敲序列字符唤出弹窗。
 * 不设超时窗口——缓冲区只保留序列长度，慢敲也成立。
 */
function useEasterEgg(open: () => void) {
	useEffect(() => {
		let buffer = "";
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
			const target = e.target as HTMLElement | null;
			if (
				target?.closest("input, textarea, select, [contenteditable=true], [role=textbox]")
			) {
				return;
			}
			buffer = (buffer + e.key.toLowerCase()).slice(-EASTER_EGG_SEQUENCE.length);
			if (buffer === EASTER_EGG_SEQUENCE) {
				buffer = "";
				open();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open]);
}
