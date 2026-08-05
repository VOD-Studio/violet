/**
 * Docx 渲染 Hook
 *
 * 使用 docx-preview 的 renderAsync 把 .docx Blob 渲染到容器。
 * 管理 url 变化时的重新渲染与加载/错误状态。
 */

import { renderAsync } from "docx-preview";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DocxLoadStatus } from "../types/docx-preview-types";

interface UseDocxRenderOptions {
	url: string;
}

export function useDocxRender({ url }: UseDocxRenderOptions) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [loadStatus, setLoadStatus] = useState<DocxLoadStatus>("loading");

	const render = useCallback(async () => {
		const container = containerRef.current;
		if (!container) return;

		setLoadStatus("loading");
		try {
			// 拉取文件为 Blob（docx-preview 需要 Blob/ArrayBuffer）
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blob = await res.blob();

			// 清空旧内容
			container.innerHTML = "";
			await renderAsync(blob, container, undefined, {
				className: "docx",
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				breakPages: true,
			});
			setLoadStatus("ready");
		} catch {
			setLoadStatus("error");
		}
	}, [url]);

	useEffect(() => {
		void render();
	}, [render]);

	const retry = useCallback(() => {
		void render();
	}, [render]);

	return { containerRef, loadStatus, retry };
}
