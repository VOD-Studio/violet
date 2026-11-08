import { getContrastRatio, hexToOklch } from "@shared/lib/color-math";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

function asOklch(hex: string) {
	const color = hexToOklch(hex);
	return color ? `oklch(${color.l} ${color.c} ${color.h})` : null;
}

function readPaperContrast(editor: Editor, color: string): number | undefined {
	const foreground = asOklch(color);
	if (!foreground) return undefined;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return undefined;
	const ancestors: HTMLElement[] = [];
	for (let node: HTMLElement | null = editor.view.dom; node; node = node.parentElement) {
		ancestors.push(node);
	}
	// 编辑区本身透明时，按真实祖先纸面合成，不用固定白色替代深色纸。
	for (const node of ancestors.reverse()) {
		context.fillStyle = getComputedStyle(node).backgroundColor;
		context.fillRect(0, 0, 1, 1);
	}
	const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
	if (alpha !== 255) return undefined;
	const paper = asOklch(
		`#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
	);
	return paper ? getContrastRatio(foreground, paper) : undefined;
}

interface EditorTextColor {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: string | undefined;
	recentColors: string[];
	onColorCommit: (color: string) => void;
	contrast: { ratio: number } | undefined;
}

/** 编辑器保留模型选区，颜色面板独立持有焦点；最近色只在完成操作时记录。 */
export function useEditorTextColor(editor: Editor | null): EditorTextColor {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState<string | undefined>(undefined);
	const [recentColors, setRecentColors] = useState<string[]>([]);
	const [ratio, setRatio] = useState<number | undefined>(undefined);

	useEffect(() => {
		if (!editor) return;
		const update = () => {
			const next = editor.getAttributes("textStyle").color as string | undefined;
			setValue(next);
			setRatio(open && next ? readPaperContrast(editor, next) : undefined);
		};
		update();
		editor.on("transaction", update);
		const observer = new MutationObserver(update);
		if (open) {
			for (let node: HTMLElement | null = editor.view.dom; node; node = node.parentElement) {
				observer.observe(node, {
					attributes: true,
					attributeFilter: ["class", "style", "data-theme"],
				});
			}
			observer.observe(document.head, {
				childList: true,
				characterData: true,
				subtree: true,
			});
		}
		return () => {
			editor.off("transaction", update);
			observer.disconnect();
		};
	}, [editor, open]);

	const commit = useCallback((color: string) => {
		setRecentColors((recent) =>
			[color, ...recent.filter((entry) => entry !== color)].slice(0, 6),
		);
	}, []);

	return {
		open,
		onOpenChange: setOpen,
		value,
		recentColors,
		onColorCommit: commit,
		contrast: ratio === undefined ? undefined : { ratio },
	};
}
