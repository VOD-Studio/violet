/**
 * useEditorUpload - 编辑器图片上传 hook
 *
 * 提供两种图片插入路径：
 * 1. 拖拽/粘贴：自动走分片上传（purpose=post），上传后插入到光标处
 * 2. 本地选择文件：同上，由工具栏按钮触发文件选择器
 *
 * 复用 upload 模块的 useChunkedUpload（秒传 + 断点续传），不重复造轮。
 */

import type { Editor } from "@tiptap/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";

export function useEditorUpload(editor: Editor | null) {
    const { uploadFile } = useChunkedUpload({ purpose: "post" });

    /**
     * uploadAndInsert - 上传单个图片文件并插入编辑器
     */
    const uploadAndInsert = useCallback(
        async (file: File) => {
            if (!editor) return;
            if (!file.type.startsWith("image/")) {
                toast.error("仅支持图片文件");
                return;
            }
            const tid = toast.loading("图片上传中…");
            try {
                const result = await uploadFile(file);
                editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
                toast.success("图片已插入", { id: tid });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "图片上传失败";
                toast.error(msg, { id: tid });
            }
        },
        [editor, uploadFile],
    );

    /**
     * pickLocalFile - 打开文件选择器，选择后上传插入
     */
    const pickLocalFile = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
            const f = input.files?.[0];
            if (f) uploadAndInsert(f);
        };
        input.click();
    }, [uploadAndInsert]);

    return { uploadAndInsert, pickLocalFile };
}
