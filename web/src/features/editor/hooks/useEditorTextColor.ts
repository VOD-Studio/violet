import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

interface EditorTextColor {
	value: string | undefined;
	recentColors: string[];
	onColorCommit: (color: string) => void;
}

/** 编辑器保留模型选区，颜色面板独立持有焦点；最近色只在完成操作时记录。 */
export function useEditorTextColor(editor: Editor | null): EditorTextColor {
	const [value, setValue] = useState<string | undefined>(undefined);
	const [recentColors, setRecentColors] = useState<string[]>([]);

	useEffect(() => {
		if (!editor) return;
		const update = () =>
			setValue(editor.getAttributes("textStyle").color as string | undefined);
		update();
		editor.on("transaction", update);
		return () => {
			editor.off("transaction", update);
		};
	}, [editor]);

	const commit = useCallback((color: string) => {
		setRecentColors((recent) =>
			[color, ...recent.filter((entry) => entry !== color)].slice(0, 6),
		);
	}, []);

	return { value, recentColors, onColorCommit: commit };
}
