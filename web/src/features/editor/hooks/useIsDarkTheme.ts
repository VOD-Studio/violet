/**
 * useIsDarkTheme - 读取站点当前明暗主题（响应式）
 *
 * next-themes 用 attribute="class" 把当前解析值（light/dark）写在 <html> 上
 * （见 web/src/styles.css 注释 + shared/ui/theme-transition.tsx 的 applyThemeClass）。
 * 编辑器 NodeView 在 React 树深处、拿不到 ThemeProvider 上下文成本高，直接读
 * <html>.classList.contains("dark") 最稳；用 MutationObserver 监听 class 变化，
 * 主题切换时图块重渲染（mermaid 颜色烘焙进 SVG，必须重新 initialize + render）。
 *
 * 与 shared/ui/particle-field.tsx 读取主题同一手法。
 */
import { useEffect, useState } from "react";

export function useIsDarkTheme(): boolean {
    const [isDark, setIsDark] = useState<boolean>(() =>
        typeof document !== "undefined"
            ? document.documentElement.classList.contains("dark")
            : false,
    );

    useEffect(() => {
        const root = document.documentElement;
        const sync = () => setIsDark(root.classList.contains("dark"));
        // 初始同步一次：mount 可能晚于主题注入
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(root, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    return isDark;
}
