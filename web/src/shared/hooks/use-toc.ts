import { Slugger } from "@shared/lib/slug";
import { useRouter } from "@tanstack/react-router";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

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

/**
 * 从已渲染的正文提取目录，保留现有锚点并为无 ID 的标题生成唯一锚点。
 *
 * @param root - 正文根节点；仅检索其中的 H2/H3/H4
 * @returns 按 DOM 顺序排列的目录项
 */
export function extractDomToc(root: HTMLElement): TocItem[] {
	const headings = root.querySelectorAll<HTMLElement>("h2, h3, h4");
	const usedIds = new Set(Array.from(root.querySelectorAll<HTMLElement>("[id]"), (el) => el.id));
	const slugger = new Slugger();
	const items: TocItem[] = [];
	for (const heading of headings) {
		// 演示卡内部的标题不属于文档正文，跳过提取
		if (heading.closest("[data-toc-ignore]")) continue;
		const text = (heading.textContent ?? "").trim();
		if (!text) continue;
		if (!heading.id) {
			let id = slugger.slug(text);
			while (usedIds.has(id) || document.getElementById(id)) id = slugger.slug(text);
			heading.id = id;
			usedIds.add(id);
		}
		items.push({
			level: Number(heading.tagName.slice(1)) as TocItem["level"],
			text,
			id: heading.id,
		});
	}
	return items;
}

/**
 * 仅拦截无修饰键的目录链接；哈希与定位交给导航操作，保留新标签页等原生行为。
 *
 * @param event - 目录锚点的点击事件
 * @param id - 对应正文标题的 ID
 * @param navigateTo - 处理哈希与滚动的导航操作
 */
export function handleTocLinkClick(
	event: MouseEvent<HTMLAnchorElement>,
	id: string,
	navigateTo: (id: string) => void,
) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return;
	event.preventDefault();
	// 同页哈希交给导航操作，避免路由器额外执行一次即时滚动。
	navigateTo(id);
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
 * @param items - 标题集变化时重新绑定滚动观察
 * @returns 当前高亮的标题 ID，无标题时返回 null
 *
 * @example
 * ```tsx
 * const activeId = useActiveHeading(contentRef);
 * return <ArticleToc items={toc} activeId={activeId} />;
 * ```
 */
export function useActiveHeading(
	containerRef: React.RefObject<HTMLElement | null>,
	items?: readonly TocItem[],
): string | null {
	const [active, setActive] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: items 变化表示 DOM 标题已替换，必须重新绑定观察
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const headings = Array.from(
			el.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]"),
		).filter((heading) => !heading.closest("[data-toc-ignore]"));
		if (headings.length === 0) return;
		const orderedIds = headings.map((h) => h.id);

		const triggerOffsets = headings.map(
			(heading) =>
				Number.parseFloat(getComputedStyle(heading).scrollMarginTop) ||
				DEFAULT_TRIGGER_OFFSET,
		);

		const update = () => {
			// 锚点滚动可能停在触发线后不足 1px；容差避免仍高亮上一节。
			const offsets = headings.map(
				(h, index) => h.getBoundingClientRect().top - triggerOffsets[index] - 1,
			);
			const pageHeight = document.documentElement.scrollHeight;
			const atPageEnd =
				pageHeight > window.innerHeight &&
				window.scrollY + window.innerHeight >= pageHeight - 1;
			const idx = atPageEnd ? orderedIds.length - 1 : pickActiveByPosition(offsets);
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
	}, [containerRef, items]);

	return active;
}

/**
 * 目录定位与当前位置跟踪，不限制调用方使用列表、折叠树或阅读轨等外观。
 *
 * @param containerRef - 包含目录标题的正文容器
 * @param items - 已渲染的目录项，用于正文切换后的重新绑定
 * @returns 当前标题与定位函数；偏好减弱动态时取消平滑滚动
 */
export function useTocNavigation(
	containerRef: React.RefObject<HTMLElement | null>,
	items?: readonly TocItem[],
) {
	const router = useRouter({ warn: false });
	const observedActiveId = useActiveHeading(containerRef, items);
	const [manualActiveId, setManualActiveId] = useState<string | null>(null);

	const navigateTo = useCallback(
		async (id: string) => {
			const hash = `#${encodeURIComponent(id)}`;
			if (window.location.hash !== hash) {
				if (router) {
					// hash 写入须先于滚动提交：WebKit 中导航异步落盘 history 会中断
					// 进行中的平滑滚动（表现为直接跳变）。
					await router.navigate({
						hash: id,
						hashScrollIntoView: false,
						resetScroll: false,
					});
				} else {
					window.history.pushState(null, "", hash);
				}
			}
			const target = document.getElementById(id);
			if (!target || !containerRef.current?.contains(target)) return;
			setManualActiveId(id);
			const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
			target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
		},
		[containerRef, router],
	);

	useEffect(() => {
		const clearManual = () => setManualActiveId(null);
		window.addEventListener("wheel", clearManual, { passive: true });
		window.addEventListener("touchstart", clearManual, { passive: true });
		window.addEventListener("keydown", clearManual);
		window.addEventListener("pointerdown", clearManual);
		window.addEventListener("scrollend", clearManual, { passive: true });
		return () => {
			window.removeEventListener("wheel", clearManual);
			window.removeEventListener("touchstart", clearManual);
			window.removeEventListener("scrollend", clearManual);
			window.removeEventListener("keydown", clearManual);
			window.removeEventListener("pointerdown", clearManual);
		};
	}, []);

	return { activeId: manualActiveId ?? observedActiveId, navigateTo };
}
