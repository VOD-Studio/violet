/**
 * useArticleImagePreview - 文章正文图片点击预览
 *
 * 挂在正文容器 ref 上：拦截容器内 <img> 的点击，收集所有图片 src，
 * 用 ImagePreview 打开全屏预览（缩放/旋转）。
 * 传入缩略图列表（imageUrl 生成 600px 缩略），防止原图过大导致预览卡顿。
 *
 * 用法：const { bind, preview } = useArticleImagePreview();
 *       <div ref={bind}>...正文...</div>
 *       {preview}
 */

import { useCallback, useRef, useState } from "react";
import { imageUrl } from "@shared/lib/image-url";
import { ImagePreview } from "@/shared/ui/image-preview";

export function useArticleImagePreview() {
    const containerRef = useRef<HTMLElement>(null);
    const [state, setState] = useState<{
        open: boolean;
        images: string[];
        thumbnails: string[];
        index: number;
        trigger: HTMLElement | null;
    }>({ open: false, images: [], thumbnails: [], index: 0, trigger: null });

    const openPreview = useCallback((target: HTMLElement) => {
        const container = target.closest("[data-article-content]") as HTMLElement | null;
        if (!container) return;
        const imgs = Array.from(container.querySelectorAll("img"));
        const srcs = imgs.map((img) => img.getAttribute("src") || "").filter(Boolean);
        const idx = imgs.indexOf(target as HTMLImageElement);
        if (srcs.length === 0) return;
        setState({
            open: true,
            images: srcs,
            // 缩略图：原图 600px 宽 webp，用于预览飞入动画 + 翻页占位，防原图卡顿
            thumbnails: srcs.map((s) => imageUrl(s, { w: 600, format: "webp" })),
            index: Math.max(0, idx),
            trigger: target as HTMLImageElement,
        });
    }, []);

    /** 容器点击事件：命中 img 时打开预览 */
    const onClick = useCallback(
        (e: React.MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== "IMG") return;
            e.preventDefault();
            openPreview(target);
        },
        [openPreview],
    );

    /** 容器键盘事件：聚焦的图片按 Enter/Space 时打开预览 */
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== "IMG") return;
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            openPreview(target);
        },
        [openPreview],
    );

    const close = useCallback(() => {
        setState((s) => ({ ...s, open: false }));
    }, []);

    const previewElement = (
        <ImagePreview
            open={state.open}
            onClose={close}
            images={state.images}
            thumbnails={state.thumbnails}
            currentIndex={state.index}
            onIndexChange={(index) => setState((s) => ({ ...s, index }))}
            triggerElement={state.trigger}
        />
    );

    return {
        /** 绑定到正文容器的 props */
        bind: {
            ref: containerRef,
            "data-article-content": true,
            onClick,
            onKeyDown,
        },
        /** ImagePreview 元素，渲染到组件末尾 */
        preview: previewElement,
    };
}
