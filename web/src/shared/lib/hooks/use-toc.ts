import { slugify } from "@shared/lib/slug";
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
 * extractToc - 从 HTML 字符串提取 H2/H3/H4 与 id（纯函数）
 *
 * 仅识别带 id 的标题（如 <h2 id="...">）。id 缺失时按文本 slug 生成。
 */
export function extractToc(html: string): TocItem[] {
    const re = /<h([234])[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
    const out: TocItem[] = [];
    const seen = new Map<string, number>();
    let m = re.exec(html);
    while (m !== null) {
        const level = Number(m[1]) as 2 | 3 | 4;
        const text = stripTags(m[3]).trim();
        if (text) {
            let id = m[2] || slugify(text);
            // 去重：重复 id 追加递增序号，与 github-slugger 行为一致
            const count = seen.get(id) ?? 0;
            seen.set(id, count + 1);
            if (count > 0) {
                id = `${id}-${count}`;
                seen.set(id, 1);
            }
            out.push({ level, id, text });
        }
        m = re.exec(html);
    }
    return out;
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, "");
}

/**
 * pickActiveHeading - 从「当前可见的 heading id 集合」中选出当前章节（纯函数）
 *
 * 规则：按文档顺序，取可见集合里的最后一个 —— 即最近一个滚过顶部高亮线的标题。
 * visibleIds 无序（来自 IntersectionObserver 回调），orderedIds 给出文档顺序。
 * 无可见项时返回 null（说明还在第一个标题之前）。
 */
export function pickActiveHeading(visibleIds: string[], orderedIds: string[]): string | null {
    if (visibleIds.length === 0) return null;
    const visible = new Set(visibleIds);
    let current: string | null = null;
    for (const id of orderedIds) {
        if (visible.has(id)) current = id;
    }
    return current;
}

/**
 * useActiveHeading - 返回当前视口内最靠上可见的 heading id（TOC 高亮）
 *
 * 用 IntersectionObserver 监听容器内 h2/h3/h4[id]，rootMargin 把「高亮触发线」
 * 设在距顶部约 80px（与 sticky 头部高度 + 缓冲一致，对齐 scroll-mt-20）。
 * 进入该线的标题加入可见集合，由 pickActiveHeading 按文档顺序选出当前章节。
 */
export function useActiveHeading(containerRef: React.RefObject<HTMLElement | null>): string | null {
    const [active, setActive] = useState<string | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const headings = Array.from(el.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]"));
        const orderedIds = headings.map((h) => h.id);
        if (orderedIds.length === 0) return;

        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.id;
                    if (entry.isIntersecting) visible.add(id);
                    else visible.delete(id);
                }
                setActive(pickActiveHeading(Array.from(visible), orderedIds));
            },
            // 顶部 80px 为「已滚过」触发线；底部 -50% 收窄可见区，避免一次点亮过多
            { rootMargin: "-80px 0px -50% 0px", threshold: 0 },
        );

        for (const h of headings) observer.observe(h);
        return () => observer.disconnect();
    }, [containerRef]);

    return active;
}
