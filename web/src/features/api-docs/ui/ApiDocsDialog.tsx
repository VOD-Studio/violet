import { PaperDialog } from "@shared/ui/paper-dialog";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";

import { useApiDocsDialogStore } from "../model/store";
import { ApiReference } from "./ApiReference";

/** 键入序列彩蛋：非输入态下连敲 a-p-i 唤出纸弹窗 */
const EASTER_EGG_SEQUENCE = "api";

/** 在前台以纯白手撕毛边纸弹窗呈现实时 API 参考文档。 */
export function ApiDocsDialog() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const close = useApiDocsDialogStore((s) => s.close);
	const open = useApiDocsDialogStore((s) => s.open);

	useEasterEgg(open);

	return (
		<PaperDialog
			open={isOpen}
			onOpenChange={(next) => (next ? open() : close())}
			seal="SPEC · 准"
			folio={
				<>
					<span>VIOLET CODEX</span>
					<span className="text-muted-foreground/40">·</span>
					<span className="font-bold text-foreground">FOLIO 01 / 接口手卷</span>
				</>
			}
			description="全栈实时接口契约便笺 · 与线上代码版本同步"
			actions={
				<Link
					to="/docs"
					onClick={close}
					className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border/80 bg-background/60 px-3 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<span>独立大页</span>
					<ArrowUpRight className="size-3.5" />
				</Link>
			}
		>
			<ApiReference variant="dialog" />
		</PaperDialog>
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
