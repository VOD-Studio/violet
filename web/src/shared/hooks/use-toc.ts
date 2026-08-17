import { Slugger } from "@shared/lib/slug";
import { useEffect, useState } from "react";

/** 目录项条目 */
export interface TocItem {
	/** 标题层级（H2 / H3 / H4） */
	level: 2 | 3 | 4;
	/** 标题纯文本 */
	text: string;
	/** 锚点 ID */
	id: string;
}

/**
 * 从 HTML 正文字符串中正则提取 H2/H3/H4 标题并生成带唯一 ID 的目录树结构（纯函数）。
 *
 * @param html - 正文 HTML 内容
 * @returns 解析出的目录项数组
 */
export function extractToc(html: string): TocItem[] {
	const re = /<h([234])[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
	const out: TocItem[] = [];
	const slugger = new Slugger();
	let m = re.exec(html);
	while (m !== null) {
		const level = Number(m[1]) as 2 | 3 | 4;
		const explicitId = m[2];
		const rawText = m[3].replace(/<[^>]+>/g, "").trim();
		const id = explicitId || slugger.slug(rawText);
		out.push({ level, text: rawText, id });
		m = re.exec(html);
	}
	return out;
}

/** 默认触发线偏移，与 styles.css 的 scroll-margin-top: 80px 一致，作为读取失败时的兜底 */
const DEFAULT_TRIGGER_OFFSET = 80;

/**
 * 根据标题相对视口触发线的偏移数组，定位当前阅读位置应高亮的标题索引（纯函数）。
 *
 * @param offsets - 各标题相对触发线的像素距离（<= 0 表示已越过）
 * @returns 命中标题在列表中的下标；全未越过时回落到 0，空列表返回 null
 */
export function pickActiveByPosition(offsets: number[]): number | null {
	if (offsets.length === 0) return null;
	let last = -1;
	for (let i = 0; i < offsets.length; i++) {
		if (offsets[i] <= 0) last = i;
	}
	return last === -1 ? 0 : last;
}

/**
 * 监听正文容器内的标题滚动位置，返回当前阅读进度对应的高亮 Heading ID。
 *
 * @param containerRef - 正文 DOM 容器 Ref
 * @returns 当前高亮的标题 ID，无标题时返回 null
 *
 * @example
 * ```tsx
 * const activeId = useActiveHeading(contentRef);
 * return <ArticleToc items={toc} activeId={activeId} />;
 * ```
 */
export function useActiveHeading(containerRef: React.RefObject<HTMLElement | null>): string | null {
	const [active, setActive] = useState<string | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const headings = Array.from(el.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]"));
		if (headings.length === 0) return;
		const orderedIds = headings.map((h) => h.id);

		const triggerOffset =
			Number.parseFloat(getComputedStyle(headings[0]).scrollMarginTop) ||
			DEFAULT_TRIGGER_OFFSET;

		const update = () => {
			const offsets = headings.map((h) => h.getBoundingClientRect().top - triggerOffset);
			const idx = pickActiveByPosition(offsets);
			setActive(idx === null ? null : orderedIds[idx]);
		};

		update();

		// 滚动与尺寸变化用 rAF 合并，避免每帧重复读布局
		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				update();
			});
		};

		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule, { passive: true });

		const resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(el);

		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			if (frame) cancelAnimationFrame(frame);
			resizeObserver.disconnect();
		};
	}, [containerRef]);

	return active;
}
