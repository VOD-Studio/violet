/**
 * useWordCount - 字数统计 hook
 *
 * 监听编辑器文档变化，统计可见文本字符数（中文按字、英文按词折算为字符，
 * 此处采用更直观的「去除空白与 markdown 符号后的字符数」近似）。
 */

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

/**
 * 统计纯文本字符数（去 HTML 标签、去多余空白）
 */
function countChars(text: string): number {
    const cleaned = text.replace(/\s+/g, "");
    return cleaned.length;
}

export function useWordCount(editor: Editor | null): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!editor) return;
        const update = () => {
            // editor 在重连/重挂载竞态下 schema 可能为 null（见 reconnectPassiveEffects 栈），
            // isDestroyed 兜底已销毁实例，schema 兜底未完成初始化的实例。
            if (editor.isDestroyed || !editor.schema) return;
            setCount(countChars(editor.getText()));
        };
        update();
        editor.on("update", update);
        return () => {
            editor.off("update", update);
        };
    }, [editor]);

    return count;
}
