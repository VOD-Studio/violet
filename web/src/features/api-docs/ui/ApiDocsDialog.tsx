import { Modal } from "@shared/ui/modal";
import { Link } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";

import { useApiDocsDialogStore } from "../model/store";
import { ApiReference } from "./ApiReference";

/** 键入序列彩蛋：非输入态下连敲 a-p-i 唤出纸弹窗 */
const EASTER_EGG_SEQUENCE = "api";

/**
 * API 文档纸弹窗：常驻 __root，一张纸面文档浮于页面之上。
 * 内容即 ApiReference 渲染器（与 /docs 全页同源），纸感由
 * 纸面 token（bg-paper 族）+ 衬线题头 + 双细线边框构成。
 */
export function ApiDocsDialog() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const close = useApiDocsDialogStore((s) => s.close);
	const open = useApiDocsDialogStore((s) => s.open);

	useEasterEgg(open);

	return (
		<Modal
			open={isOpen}
			onOpenChange={(next) => (next ? open() : close())}
			unstyled
			scrollable={false}
			titleSrOnly
			title="API 文档"
			className="flex w-[calc(100vw-2rem)] flex-col sm:max-w-175"
		>
			{/* 毛边滤镜：分形噪声位移纸层轮廓；seed 固定保证每次开合同一张纸。
			    octaves 控制在 3——层数再多会把噪声压回中值、撕纸感变弱 */}
			<svg aria-hidden="true" className="pointer-events-none absolute size-0">
				<filter id="api-paper-rough" x="-4%" y="-4%" width="108%" height="108%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.012"
						numOctaves="3"
						seed="7"
						result="noise"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="noise"
						scale="40"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
			</svg>
			{/* 纸张本体层：单独成层承受滤镜位移，内容层不受形变。
			    根容器不能 overflow-hidden——毛边要伸出矩形边界；
			    filter 走 inline style：Tailwind arbitrary 属性类可能不生成 */}
			<div
				aria-hidden
				className="absolute inset-0 border-2 border-paper-foreground/60 bg-paper shadow-[0_2px_4px_rgb(0_0_0/0.1),0_24px_56px_-16px_rgb(0_0_0/0.45)]"
				style={{ filter: "url(#api-paper-rough)" }}
			/>
			<header className="relative flex items-center gap-3 px-6 pt-5 pb-4">
				<div className="min-w-0 flex-1">
					<p className="font-mono text-[10px] tracking-[0.25em] text-paper-muted uppercase">
						Appendix · API Reference
					</p>
					<h2 className="mt-1 font-serif text-lg leading-tight font-semibold tracking-wide text-paper-foreground">
						接口文档
					</h2>
				</div>
				<Link
					to="/docs"
					onClick={close}
					className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] text-paper-muted transition-colors hover:text-paper-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					独立页
					<ExternalLink className="size-3" />
				</Link>
				<button
					type="button"
					onClick={close}
					aria-label="关闭"
					className="rounded-sm p-1.5 text-paper-muted transition-colors hover:bg-paper-foreground/5 hover:text-paper-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<X className="size-4" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-10">
				<ApiReference variant="dialog" />
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
