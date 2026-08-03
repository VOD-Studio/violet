/**
 * extractDiagramLabel - 从 mermaid 源码提取图表可读标题（供 aria-label）
 *
 * 屏幕阅读器读到「流程图」泛词无法理解图表含义，改为从源码提取实际标题。
 * 优先级：title 关键字 > 行首 %% 注释 > 降级「Mermaid 图表」
 */

/** 降级标题：源码无任何可识别标题信息时使用 */
export const FALLBACK_DIAGRAM_LABEL = "Mermaid 图表";

/**
 * 从 mermaid 源码提取 aria-label 文本。
 *
 * 扫描顺序：
 * 1. title 关键字（inline `title: X`、YAML frontmatter、`%%{init}%%` 指令内）
 * 2. 行首 `%%` 注释（跳过 `%%{init}%%` 指令）
 * 3. 降级 {@link FALLBACK_DIAGRAM_LABEL}
 */
export function extractDiagramLabel(source: string): string {
    if (!source.trim()) return FALLBACK_DIAGRAM_LABEL;

    const lines = source.split("\n");

    // 优先级 1：title 关键字
    for (const raw of lines) {
        const line = raw.trim();

        // %%{init}%% 指令内嵌的 "title": "value"
        if (line.startsWith("%%{")) {
            const dirTitle = line.match(/"title"\s*:\s*"([^"]+)"/);
            if (dirTitle) return dirTitle[1];
            continue;
        }

        // title: value（inline 或 YAML frontmatter）
        const titleMatch = line.match(/^title\s*[:：]\s*(.+)/i);
        if (titleMatch) {
            const title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
            if (title) return title;
        }
    }

    // 优先级 2：行首 %% 注释（遇到首个非注释行即停）
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("%%{")) continue; // 指令已查过 title
        if (line.startsWith("%%")) {
            const text = line
                .replace(/^%%\s*/, "")
                .replace(/\s*%%$/, "")
                .trim();
            if (text) return text;
            continue;
        }
        break; // 首个有意义的行（图表类型声明）→ 停止
    }

    return FALLBACK_DIAGRAM_LABEL;
}
