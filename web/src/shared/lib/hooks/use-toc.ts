import { Slugger } from "@shared/lib/slug";
import { useEffect, useState } from "react";

export interface TocItem {
    /** 标题层级 2|3|4 */
    level: 2 | 3 | 4;
    /** 标题文本 */
    text: string;
    /** 锚点 id */
    id: string;
}

/**
 * extractToc - 从 HTML 字符串提取 H2/H3/H4 与 id，纯函数
 *
 * id 缺失时用项目统一 Slugger 生成（与 markdown 路径 extractMarkdownToc /
 * markdownToHtml / rehypeSlugHeadings 同规则），保证 HTML 渲染补的
 * id（HtmlContent.ensureHeadingIds 用同一 Slugger）与 TOC 提取的 id 一致，
 * 点击目录才能滚动到位。
 */
export function extractToc(html: string): TocItem[] {
    const re = /<h([234])[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
    const out: TocItem[] = [];
    const slugger = new Slugger();
    let m = re.exec(html);
    while (m !== null) {
        const level = Number(m[1]) as 2 | 3 | 4;
        const text = stripTags(m[3]).trim();
        if (text) {
            const id = m[2] || slugger.slug(text);
            out.push({ level, id, text });
        }
        m = re.exec(html);
    }
    return out;
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, "");
}

/** 默认触发线偏移，与 styles.css 的 scroll-margin-top: 80px 一致，作为读取失败时的兜底 */
const DEFAULT_TRIGGER_OFFSET = 80;

/**
 * pickActiveByPosition - 在文档顺序的标题中取最后一个顶部已越过触发线的，纯函数
 *
 * offsets[i] 为第 i 个标题顶部相对触发线的有符号距离，<= 0 表示已越过触发线进入阅读区。
 * 取文档顺序里最后一个已越过的标题；若全部尚未越过，回落到第一个标题，保证首章可见即高亮。
 * 空列表返回 null。
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
 * useActiveHeading - 返回当前阅读位置的 heading id，供 TOC 高亮
 *
 * 以「最后一个顶部越过触发线的标题」为当前章节：滚到哪高亮哪，既不会提前选中下一章，
 * 也不会在大段正文里丢失高亮。触发线偏移直接读 CSS scroll-margin-top，与点击锚点跳转的
 * 停留位置共享同一来源；读不到时回落到默认 80px。
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
        return () => {
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [containerRef]);

    return active;
}
