/**
 * theme-variables - mermaid 主题变量映射（站点 oklch → mermaid hex）
 *
 * 单一职责：读站点 CSS 变量（shadcn neutral oklch 调色板）→ 转 hex →
 * 组装 mermaid themeVariables。框架色（背景/文字/线条/边框）对齐站点明暗，
 * 节点填色（primaryColor/secondaryColor/tertiaryColor）刻意不设置——保留
 * mermaid 默认彩色，避免站点全灰度导致流程图节点难辨（PRD「节点保色」决策）。
 *
 * 探针元素带 .dark 类即可读到暗色变量（.dark 选择器匹配任意带该类的元素，
 * 不依赖 <html> 当前实际主题）——切主题时调用方重新调用本函数即可，无副作用。
 */
/** mermaid themeVariables 子集：只覆盖框架色，节点填色留给 mermaid 默认 */
export interface MermaidThemeVariables {
    /** 图表整体背景 */
    background?: string;
    /** 主文字色（节点内文字） */
    primaryTextColor?: string;
    /** 连线颜色 */
    lineColor?: string;
    /** 主边框颜色 */
    primaryBorderColor?: string;
}

/** 站点 CSS 变量读不到时（SSR / 测试环境无 CSS）的灰度兜底，保证渲染不白屏 */
const FALLBACK_LIGHT = { background: "#ffffff", foreground: "#0a0a0a", border: "#e5e5e5" };
const FALLBACK_DARK = { background: "#0a0a0a", foreground: "#fafafa", border: "#262626" };

/**
 * cssColorToHex - 任意 CSS 颜色（oklch/rgb/hsl/named/hex）→ #rrggbb
 *
 * 借浏览器的颜色解析器：把颜色设到探针元素的 color 上，读 computed color
 * （浏览器统一规范化为 rgb()/rgba()），再解析为 hex。mermaid themeVariables
 * 只认 hex（官方 theming 文档），所以必须转。hex 输入走短路，避免无谓 DOM 操作。
 * 空/null/undefined → null（不变黑），让调用方走兜底。
 */
export function cssColorToHex(color: string | undefined | null): string | null {
    const value = color?.trim();
    if (!value) return null;
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) {
        return value.slice(0, 7).toLowerCase();
    }
    if (typeof window === "undefined" || typeof document === "undefined") return null;
    const probe = document.createElement("span");
    probe.style.color = value;
    probe.style.display = "none";
    document.documentElement.appendChild(probe);
    const computed = window.getComputedStyle(probe).color;
    probe.remove();
    const match = computed.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const channels = match[1].split(",").map((n) => Number.parseFloat(n));
    if (channels.some((n) => Number.isNaN(n))) return null;
    const [r, g, b] = channels;
    return `#${[r, g, b]
        .map((n) =>
            Math.max(0, Math.min(255, Math.round(n)))
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

/**
 * readSiteVar - 读站点 CSS 变量，按 isDark 选浅/深变体
 *
 * 探针带 .dark 类时，.dark { --x: ... } 规则直接作用于该元素，读到暗色值；
 * 不带类时读到 :root 的浅色值。与 <html> 当前主题解耦。
 */
function readSiteVar(name: string, isDark: boolean): string {
    if (typeof window === "undefined" || typeof document === "undefined") return "";
    const probe = document.createElement("span");
    if (isDark) probe.className = "dark";
    probe.style.display = "none";
    document.documentElement.appendChild(probe);
    try {
        return window.getComputedStyle(probe).getPropertyValue(name).trim();
    } finally {
        probe.remove();
    }
}

/**
 * getThemeVariables - 组装 mermaid themeVariables（站点明暗 → mermaid hex）
 *
 * 框架色从站点 CSS 变量读取并转 hex；节点填色（primaryColor 等）不设置，
 * 保留 mermaid 默认彩色（PRD「框架对齐明暗 + 节点保色」策略）。
 * isDark 决定读浅色（:root）还是深色（.dark）变体。
 */
export function getThemeVariables(isDark: boolean): MermaidThemeVariables {
    const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
    const resolve = (varName: string, fb: string): string =>
        cssColorToHex(readSiteVar(varName, isDark)) ?? fb;
    return {
        background: resolve("--background", fallback.background),
        primaryTextColor: resolve("--foreground", fallback.foreground),
        lineColor: resolve("--border", fallback.border),
        primaryBorderColor: resolve("--border", fallback.border),
    };
}
