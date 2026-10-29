import { originalImageUrl } from "@shared/lib/image-url";
import { useCallback, useRef, useState } from "react";
import { ImagePreview } from "@/shared/ui/image-preview";

/**
 * 拦截正文容器内的图片点击与键盘聚焦事件，驱动 {@link ImagePreview} 展开大图轮播预览。
 *
 * @remarks 原图预览剥离展示变换参数；过渡占位复用浏览器实际选中的响应式候选。
 *
 * @returns 包含容器绑定属性 `bind` 与弹窗 JSX 节点 `preview` 的对象
 *
 * @example
 * ```tsx
 * const { bind, preview } = useArticleImagePreview();
 *
 * return (
 *   <div {...bind}>
 *     <ArticleContent />
 *     {preview}
 *   </div>
 * );
 * ```
 */
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
		const imgs = Array.from(container.querySelectorAll("img")).filter((img) =>
			img.getAttribute("src"),
		);
		const srcs = imgs.map((img) => img.getAttribute("src") || "");
		const idx = imgs.indexOf(target as HTMLImageElement);
		if (srcs.length === 0) return;
		setState({
			open: true,
			images: srcs.map(originalImageUrl),
			thumbnails: imgs.map((img) => img.currentSrc || img.src),
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
