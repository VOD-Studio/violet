/**
 * ImageView - 编辑器图片自定义 NodeView
 *
 * 编辑时显示层走 w=1200 缩略(contentImageUrl),避免大图源文件拖慢编辑器;
 * 不改 node.attrs.src,也不改 renderHTML——序列化(getHTML/getMarkdown)
 * 仍输出原图 URL,只影响编辑时显示,不影响存库内容。
 */
import Image from "@tiptap/extension-image";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { contentImageUrl } from "@shared/lib/image-url";

/**
 * createImageExtension:继承官方 Image,仅替换 NodeView 渲染。
 * 调用方继续 .configure({ inline, allowBase64, HTMLAttributes }) 即可。
 */
export function createImageExtension() {
    return Image.extend({
        addNodeView() {
            return ReactNodeViewRenderer(ImageViewComponent);
        },
    });
}

function ImageViewComponent({ node, selected }: NodeViewProps) {
    const src = (node.attrs.src as string) ?? "";
    const alt = (node.attrs.alt as string) ?? "";
    const title = (node.attrs.title as string | null) ?? undefined;
    return (
        <NodeViewWrapper data-type="image">
            <img
                src={contentImageUrl(src, { width: 1200 })}
                alt={alt}
                title={title}
                // rounded-lg 与原 HTMLAttributes.class 保持一致;选中态描边提示
                className={`rounded-lg ${selected ? "ring-2 ring-primary" : ""}`}
                draggable={false}
            />
        </NodeViewWrapper>
    );
}
