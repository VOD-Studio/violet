/**
 * markdownToHtml - Markdown 转 HTML（带 GFM + 标题锚点 id + 代码高亮）
 *
 * 依赖较重（marked + highlight.js + marked-highlight），刻意独立成模块，
 * 避免经 markdown barrel 泄漏进文章详情页等只需 TOC 的页面。
 *
 * 用于 PostEditor 提交时把 content_md 渲染为 content_html 存储，
 * 与详情页 TOC 的 id 规则保持一致（项目统一 slugify + Slugger）。
 */

import { Slugger } from "@shared/lib/slug";
import hljs from "highlight.js";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";

// HTML 实体反转义（marked 的 inline token 可能含 &amp; 等,影响 slug 准确性）
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(\w+));?/gi;
function unescapeEntities(s: string): string {
    return s.replace(ENTITY, (_, dec, hex, name) => {
        if (dec) return String.fromCodePoint(Number.parseInt(dec, 10));
        if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
        if (name === "colon") return ":";
        return "";
    });
}

// 每次 parse 用独立 Slugger(一篇文章内去重,跨文章不累积)。
// preprocess hook 在解析前重置,renderer.heading 用同一实例生成 id。
let slugger = new Slugger();

// 启用 GFM（表格/删除线/任务列表）+ 标题 id（项目统一 slugify 规则）+ 代码高亮
marked.use(
    {
        hooks: {
            preprocess(src) {
                slugger = new Slugger();
                return src;
            },
        },
        renderer: {
            heading({ tokens, depth }) {
                const text = this.parser.parseInline(tokens);
                const raw = unescapeEntities(text)
                    .trim()
                    .replace(/<[!/a-z].*?>/gi, "");
                const id = slugger.slug(raw);
                return `<h${depth} id="${id}">${text}</h${depth}>\n`;
            },
        },
    },
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            try {
                return hljs.highlight(code, { language }).value;
            } catch {
                return code;
            }
        },
    }),
);

/**
 * markdownToHtml - markdown 字符串转 HTML
 *
 * 标题自动带 id（项目统一 slugify + Slugger 去重规则），
 * 与详情页 TOC（extractMarkdownToc 用同一 Slugger）锚点一致。
 */
export function markdownToHtml(md: string): string {
    return marked.parse(md, { async: false }) as string;
}
