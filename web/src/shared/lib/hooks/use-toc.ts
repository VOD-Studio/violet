import { slugify } from "@shared/lib/slug";
import { useEffect, useState } from "react";

export interface TocItem {
    /** 标题层级 2|3 */
    level: 2 | 3;
    /** 标题文本 */
    text: string;
    /** 锚点 id */
    id: string;
}

/**
 * extractToc - 从 HTML 字符串提取 H2/H3 与 id（纯函数）
 *
 * 仅识别带 id 的标题（如 <h2 id="...">）。id 缺失时按文本 slug 生成。
 */
export function extractToc(html: string): TocItem[] {
    const re = /<h([23])[^>]*?(?:\sid=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi;
    const out: TocItem[] = [];
    const seen = new Map<string, number>();
    let m = re.exec(html);
    while (m !== null) {
        const level = Number(m[1]) as 2 | 3;
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
 * useActiveHeading - 返回当前视口内最靠上可见的 heading id（TOC 高亮）
 */
export function useActiveHeading(containerRef: React.RefObject<HTMLElement | null>): string | null {
    const [active, setActive] = useState<string | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            const headings = el.querySelectorAll<HTMLElement>("h2[id], h3[id]");
            let current: string | null = null;
            for (const h of Array.from(headings)) {
                if (h.getBoundingClientRect().top - 120 <= 0) {
                    current = h.id;
                }
            }
            setActive(current);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            el.removeEventListener("scroll", onScroll);
        };
    }, [containerRef]);

    return active;
}
