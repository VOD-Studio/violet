import { PaperDialog } from "@shared/ui/paper-dialog";
import { useEffect } from "react";

import { useApiDocsDialogStore } from "../model/store";
import { ApiReference } from "./ApiReference";

/** 键入序列彩蛋：非输入态下连敲 a-p-i 唤出纸弹窗 */
const EASTER_EGG_SEQUENCE = "api";

/** 在前台以手撕纯白纸弹窗呈现实时 API 参考文档。 */
export function ApiDocsDialog() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const close = useApiDocsDialogStore((s) => s.close);
	const open = useApiDocsDialogStore((s) => s.open);

	useEasterEgg(open);

	return (
		<PaperDialog
			open={isOpen}
			onOpenChange={(next) => (next ? open() : close())}
			titleSrOnly="API 参考文档手卷"
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
