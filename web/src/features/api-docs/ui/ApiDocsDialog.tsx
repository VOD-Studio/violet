import { AsyncContent } from "@shared/ui/deferred-content/DeferredContent";
import { useEffect, useState } from "react";

import { useApiDocsDialogStore } from "../model/store";

/** 键入序列彩蛋：非输入态下连敲 a-p-i 唤出纸弹窗 */
const EASTER_EGG_SEQUENCE = "api";

const loadPaper = () => import("./ApiDocsPaper");
const NO_PROPS = {};

/**
 * 在前台以手撕纯白纸弹窗呈现实时 API 参考文档。
 *
 * @remarks 常驻的只有彩蛋按键监听；文档本体首次唤出才下载，之后保留实例。
 */
export function ApiDocsDialog() {
	const isOpen = useApiDocsDialogStore((s) => s.isOpen);
	const open = useApiDocsDialogStore((s) => s.open);
	const [hasOpened, setHasOpened] = useState(isOpen);
	useEffect(() => {
		if (isOpen) setHasOpened(true);
	}, [isOpen]);

	useEasterEgg(open);

	if (!isOpen && !hasOpened) return null;
	return (
		<AsyncContent load={loadPaper} componentProps={NO_PROPS} fallback={null} label="API 文档" />
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
