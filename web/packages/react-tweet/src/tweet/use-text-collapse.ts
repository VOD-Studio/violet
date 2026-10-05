import { type RefObject, useLayoutEffect, useRef, useState } from "react";

import type { TweetSegment } from "../data/types.js";

interface TextCollapseOptions {
	maxTextLines?: number;
	text: string;
	segments?: TweetSegment[] | null;
}

interface TextCollapse {
	ref: RefObject<HTMLParagraphElement | null>;
	lines?: number;
	hasOverflow: boolean;
	isExpanded: boolean;
	toggle: () => void;
}

/** 按实际行高判断溢出；宽度、字体与正文变化后重新测量。 */
export function useTextCollapse({
	maxTextLines,
	text,
	segments,
}: TextCollapseOptions): TextCollapse {
	const ref = useRef<HTMLParagraphElement>(null);
	const [hasOverflow, setHasOverflow] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const lines =
		typeof maxTextLines === "number" && Number.isInteger(maxTextLines) && maxTextLines > 0
			? maxTextLines
			: undefined;

	// biome-ignore lint/correctness/useExhaustiveDependencies: 折叠后的高度可能不变，正文更新仍须重测。
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || lines === undefined) {
			setHasOverflow(false);
			return;
		}
		const measure = () => {
			const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
			setHasOverflow(element.scrollHeight > lineHeight * lines + 1);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		document.fonts?.addEventListener("loadingdone", measure);
		return () => {
			observer.disconnect();
			document.fonts?.removeEventListener("loadingdone", measure);
		};
	}, [lines, text, segments]);

	return {
		ref,
		lines,
		hasOverflow,
		isExpanded,
		toggle: () => setIsExpanded((value) => !value),
	};
}
