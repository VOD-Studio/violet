/**
 * HtmlContent - 安全渲染 HTML 字符串（content_html）
 *
 * 直接走 hast 管道：hast-util-raw 把 HTML 解析为 hast → hast-util-sanitize 白名单清洗 →
 * hast-util-to-jsx-runtime 渲染为 React（复用 markdownComponents，含 shiki 代码块）。
 *
 * 刻意不经过 react-markdown / remark-parse：后者会把整段 HTML 当 markdown 重新解析，
 * 代码块内的空行会被 CommonMark 当作 HTML 块边界截断，导致一个代码块被拆成多段、
 * 混入段落，格式全乱。HTML 内容必须按 HTML 解析，这是本组件存在的意义。
 */

import type { Element, Nodes } from "hast";
import { raw } from "hast-util-raw";
import { defaultSchema, sanitize } from "hast-util-sanitize";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { slugify } from "@/shared/lib/slug";
import { markdownComponents } from "./components/markdown-components";

// raw 节点（{ type: "raw"; value: html }）由 mdast-util-to-hast 全局扩展进 hast 的
// RootContentMap，hast-util-raw 据此把 HTML 字符串解析为正式 hast 节点。

/**
 * sanitize schema：在默认白名单基础上放宽，允许 class/style（shiki 高亮 + 排版所需）、
 * 以及常见文章元素（details/summary 等）。保持 script/iframe/event handler 等危险项被剥离。
 */
const schema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        // 允许 class/style，承载编辑器产出的颜色、对齐等 inline 样式
        "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "class", "style", "id"],
        // Highlight 多色高亮把颜色存在 data-color
        mark: [...(defaultSchema.attributes?.mark ?? []), "data-color"],
    },
    // 允许 article 正文中常见的额外标签
    // span：承载文本颜色；u：下划线；其余为编辑器/富文本常用元素
    tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "img",
        "figure",
        "figcaption",
        "details",
        "summary",
        "mark",
        "kbd",
        "abbr",
        "span",
        "u",
    ],
    // 不给 id 加 user-content- 前缀：文章正文来自后台编辑器（非任意用户输入），
    // heading 的 id 需与目录（extractToc 生成的 slug）一致，点击目录才能滚动到位。
    // sanitize 白名单已剥离 script/iframe 等危险项，clobber 风险可控。
    clobberPrefix: "",
};

/** HTML 字符串 → hast：包成 raw 节点交给 hast-util-raw 解析，纯 HTML 不经过 markdown */
function htmlToHast(html: string): Nodes {
    return raw({ type: "root", children: [{ type: "raw", value: html }] });
}

/** 递归提取 hast 节点的纯文本（用于给无 id 的 heading 生成 slug） */
function hastText(node: Nodes): string {
    if (node.type === "text") return node.value;
    if (node.type === "element") {
        return node.children.map((c) => hastText(c)).join("");
    }
    return "";
}

/**
 * 为 sanitize 后无 id 的 h2/h3/h4 补上 slug id，使 DOM 锚点与目录
 * （extractToc 用同一 slugify 规则生成）一致，点击目录才能滚动到位。
 * 去重规则与 extractToc 完全一致（相同文本追加 -1/-2…）。
 */
function ensureHeadingIds(tree: Nodes): Nodes {
    const seen = new Map<string, number>();
    const visit = (node: Nodes) => {
        // root 与 element 都需遍历 children（root 本身不是 element）
        if (node.type === "element") {
            const el = node as Element;
            if (
                (el.tagName === "h2" || el.tagName === "h3" || el.tagName === "h4") &&
                !el.properties?.id
            ) {
                const text = hastText(el).trim();
                if (text) {
                    let id = slugify(text);
                    const count = seen.get(id) ?? 0;
                    seen.set(id, count + 1);
                    if (count > 0) {
                        id = `${id}-${count}`;
                        seen.set(id, 1);
                    }
                    el.properties = { ...(el.properties ?? {}), id };
                }
            }
        }
        if ("children" in node) {
            for (const c of node.children) visit(c);
        }
    };
    visit(tree);
    return tree;
}

export interface HtmlContentProps {
    /** HTML 字符串 */
    html: string;
    /** 外层 className（通常含 prose 排版类） */
    className?: string;
}

export function HtmlContent({ html, className }: HtmlContentProps) {
    const cleaned = ensureHeadingIds(sanitize(htmlToHast(html), schema));
    return (
        <div className={className}>
            {toJsxRuntime(cleaned, {
                Fragment,
                jsx,
                jsxs,
                components: markdownComponents,
            })}
        </div>
    );
}
