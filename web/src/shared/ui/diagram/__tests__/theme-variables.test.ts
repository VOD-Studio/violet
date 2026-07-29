/**
 * getThemeVariables 测试
 *
 * 站点 CSS 变量是 oklch（shadcn neutral），jsdom 不解析 oklch，故 mock
 * getComputedStyle 模拟真实浏览器：getPropertyValue 返回 oklch 原值，color
 * 属性被浏览器规范化为 rgb()。cssColorToHex 的 hex/rgb/空值分支用 jsdom
 * 原生能力直测（无需 mock）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cssColorToHex, getThemeVariables } from "../theme-variables";

describe("cssColorToHex", () => {
    it("hex 输入原样返回（规范化为小写 #rrggbb）", () => {
        expect(cssColorToHex("#FFFFFF")).toBe("#ffffff");
        expect(cssColorToHex("#0a0a0a")).toBe("#0a0a0a");
        expect(cssColorToHex("#abcdef88")).toBe("#abcdef"); // 8 位 hex 取 rgb 部分
    });

    it("rgb() 输入转 #rrggbb（jsdom 原生解析）", () => {
        expect(cssColorToHex("rgb(255, 0, 0)")).toBe("#ff0000");
        expect(cssColorToHex("rgb(10, 10, 10)")).toBe("#0a0a0a");
    });

    it("空值 / null / undefined → null（不变黑）", () => {
        expect(cssColorToHex("")).toBeNull();
        expect(cssColorToHex("   ")).toBeNull();
        expect(cssColorToHex(null)).toBeNull();
        expect(cssColorToHex(undefined)).toBeNull();
    });
});

describe("getThemeVariables", () => {
    // 模拟站点 CSS 变量（与 web/src/styles.css 的 oklch 值一致）
    const LIGHT_VARS: Record<string, string> = {
        "--background": "oklch(1 0 0)",
        "--foreground": "oklch(0.145 0 0)",
        "--border": "oklch(0.922 0 0)",
    };
    const DARK_VARS: Record<string, string> = {
        "--background": "oklch(0.145 0 0)",
        "--foreground": "oklch(0.985 0 0)",
        "--border": "oklch(1 0 0 / 10%)",
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * 安装 getComputedStyle mock：探针带 .dark 类 → 返回暗色变量；否则浅色。
     * color-resolution 探针（style.color 已设）→ 把 oklch 规范化为 rgb()，
     * 模拟真实浏览器行为。L→灰度映射够测，无需感知均匀。
     */
    function mockComputedStyle(light: Record<string, string>, dark: Record<string, string>) {
        vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
            const node = el as HTMLElement;
            const isDark = node.className?.includes("dark");
            const vars = isDark ? dark : light;
            const inlineColor = node.style?.color;
            return {
                getPropertyValue: (name: string) => vars[name.trim()] ?? "",
                get color(): string {
                    if (!inlineColor) return "";
                    const m = inlineColor.match(/oklch\(\s*([\d.]+)/);
                    if (!m) return inlineColor;
                    const g = Math.round(Number.parseFloat(m[1]) * 255);
                    return `rgb(${g}, ${g}, ${g})`;
                },
            } as unknown as CSSStyleDeclaration;
        });
    }

    it("isDark=false → 返回浅色变量集（全部 hex 格式）", () => {
        mockComputedStyle(LIGHT_VARS, DARK_VARS);
        const vars = getThemeVariables(false);
        expect(vars.background).toMatch(/^#[0-9a-f]{6}$/);
        expect(vars.primaryTextColor).toMatch(/^#[0-9a-f]{6}$/);
        expect(vars.lineColor).toMatch(/^#[0-9a-f]{6}$/);
        expect(vars.primaryBorderColor).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("isDark=true → 返回暗色变量集（全部 hex 格式）", () => {
        mockComputedStyle(LIGHT_VARS, DARK_VARS);
        const vars = getThemeVariables(true);
        expect(vars.background).toMatch(/^#[0-9a-f]{6}$/);
        expect(vars.primaryTextColor).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("浅色与暗色的背景/文字色不同（证明 isDark 分支生效）", () => {
        mockComputedStyle(LIGHT_VARS, DARK_VARS);
        const light = getThemeVariables(false);
        const dark = getThemeVariables(true);
        expect(light.background).not.toBe(dark.background);
        expect(light.primaryTextColor).not.toBe(dark.primaryTextColor);
    });

    it("节点填色（primaryColor/secondaryColor/tertiaryColor）刻意未设置——保留 mermaid 默认彩色", () => {
        mockComputedStyle(LIGHT_VARS, DARK_VARS);
        const light = getThemeVariables(false);
        const dark = getThemeVariables(true);
        // PRD「节点保色」决策：框架对齐站点明暗，但节点填色不被站点灰度覆盖
        expect(light).not.toHaveProperty("primaryColor");
        expect(light).not.toHaveProperty("secondaryColor");
        expect(light).not.toHaveProperty("tertiaryColor");
        expect(dark).not.toHaveProperty("primaryColor");
        expect(dark).not.toHaveProperty("secondaryColor");
        expect(dark).not.toHaveProperty("tertiaryColor");
    });

    it("CSS 变量读不到（SSR / 无 CSS 环境）→ 走灰度兜底，不抛错且仍为 hex", () => {
        // 不装 mock：jsdom 默认 getComputedStyle 返回空字符串 → cssColorToHex 返回 null → fallback
        const light = getThemeVariables(false);
        const dark = getThemeVariables(true);
        expect(light.background).toMatch(/^#[0-9a-f]{6}$/);
        expect(dark.background).toMatch(/^#[0-9a-f]{6}$/);
        expect(light.background).not.toBe(dark.background);
    });
});
