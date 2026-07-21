/**
 * katex-element - KaTeX 白名单渲染管线（去 dangerouslySetInnerHTML）
 *
 * renderKatex 的 HTML 字符串 → hast 解析 → hast-util-sanitize 白名单 →
 * hast-util-to-jsx-runtime 生成 React 元素。标签/属性双白名单下，
 * 即使渲染器输出被污染也无法注入脚本或事件处理器（决策见 ADR-0005）。
 * 与 HtmlContent 同一管线模式，纯 JS 无 DOM 依赖，SSR 同构。
 */
import { raw } from "hast-util-raw";
import { defaultSchema, type Schema, sanitize } from "hast-util-sanitize";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { renderKatex } from "./katex-core";

/**
 * KaTeX 输出专属白名单。
 *
 * 标签只覆盖 KaTeX htmlAndMathml 产物的全集：span（HTML 排版层）+
 * MathML（无障碍注解层）+ svg/path（根号、伸缩箭头、宽帽等矢量笔画）。
 * 不继承 defaultSchema 的标签表——公式里不需要 a/img/table 等文章标签。
 *
 * 属性放行 KaTeX 布局依赖的 class/style 与 MathML/svg 语义属性；
 * style 在现代浏览器不可执行脚本，且 KaTeX 不产出 url()。
 * 事件处理器（on*）不在列，hast-util-sanitize 默认剥离。
 */
const KATEX_SCHEMA: Schema = {
    ...defaultSchema,
    tagNames: [
        "span",
        // MathML Core
        "math",
        "semantics",
        "annotation",
        "mrow",
        "mi",
        "mo",
        "mn",
        "mtext",
        "mspace",
        "msup",
        "msub",
        "msubsup",
        "mfrac",
        "msqrt",
        "mroot",
        "mtable",
        "mtr",
        "mtd",
        "munder",
        "mover",
        "munderover",
        "mpadded",
        "mphantom",
        "menclose",
        "mstyle",
        "mmultiscripts",
        "mprescripts",
        "none",
        "mlabeledtr",
        "maligngroup",
        "malignmark",
        "merror",
        "maction",
        "mstack",
        "mlongdiv",
        "mscarries",
        "mscarry",
        "msline",
        "msrow",
        "ms",
        // 矢量笔画
        "svg",
        "path",
    ],
    attributes: {
        ...defaultSchema.attributes,
        "*": [
            ...(defaultSchema.attributes?.["*"] ?? []),
            "className",
            "class",
            "style",
            "ariaHidden",
            "xmlns",
            // svg 几何
            "viewBox",
            "preserveAspectRatio",
            "d",
            "width",
            "height",
            // MathML 语义
            "encoding",
            "display",
            "mathvariant",
            "stretchy",
            "fence",
            "separator",
            "largeop",
            "movablelimits",
            "accent",
            "linethickness",
            "scriptlevel",
            "displaystyle",
            "mathcolor",
            "mathbackground",
            "notation",
            "columnalign",
            "rowspacing",
            "columnspacing",
            "lspace",
            "voffset",
            "depth",
            "valign",
            "lquote",
            "rquote",
            "xref",
        ],
    },
};

/**
 * renderKatexElement - 渲染 LaTeX 为 React 元素（白名单管线）
 *
 * 返回的 React 元素可直接嵌进任何 JSX；调用侧按需 useMemo 缓存。
 */
export function renderKatexElement(latex: string, displayMode: boolean): ReactNode {
    const tree = sanitize(
        raw({ type: "root", children: [{ type: "raw", value: renderKatex(latex, displayMode) }] }),
        KATEX_SCHEMA,
    );
    return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}
