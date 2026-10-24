import { DeferredContent } from "@shared/ui/deferred-content/DeferredContent";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { BlockCount } from "../model/types";

const loadAnnotationLayer = () =>
	import("./AnnotationLayer").then((module) => ({ default: module.AnnotationLayer }));
const loadFloatingToolbar = () =>
	import("./FloatingToolbar").then((module) => ({ default: module.FloatingToolbar }));

/** 轻量批注层的正文引用与权限快照，不包含评论正文或登录 SDK。 */
export interface ArticleAnnotationsProps {
	/** 选区必须完整位于此正文内，其他页面区域的选择不触发工具栏加载。 */
	contentRef: RefObject<HTMLElement | null>;
	/** 按块聚合的角标数据；完整批注只在读者打开相应角标时读取。 */
	summary: BlockCount[];
	postId: string;
	isLoggedIn: boolean;
}

/**
 * 保留阅读中的批注角标，在首次正文选择后接管划线批注交互。
 *
 * @remarks 工具栏激活后持续挂载；关闭输入区不会丢弃已加载模块。
 */
export function ArticleAnnotations({
	contentRef,
	summary,
	postId,
	isLoggedIn,
}: ArticleAnnotationsProps) {
	const [selectionUsed, setSelectionUsed] = useState(false);
	useEffect(() => {
		if (selectionUsed) return;
		const activate = () => {
			const selection = window.getSelection();
			if (
				selection &&
				!selection.isCollapsed &&
				selection.rangeCount > 0 &&
				contentRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)
			) {
				setSelectionUsed(true);
			}
		};
		document.addEventListener("selectionchange", activate);
		activate();
		return () => document.removeEventListener("selectionchange", activate);
	}, [contentRef, selectionUsed]);

	return (
		<>
			<DeferredContent
				defer={false}
				load={loadAnnotationLayer}
				componentProps={{ contentRef, summary, postId, isLoggedIn }}
				fallback={null}
				label="批注角标"
			/>
			{selectionUsed && (
				<DeferredContent
					defer={false}
					load={loadFloatingToolbar}
					componentProps={{ contentRef, postId, isLoggedIn }}
					fallback={null}
					label="批注工具"
				/>
			)}
		</>
	);
}
