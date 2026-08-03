/**
 * 图块导出纯函数（PRD-0012 §导出 SVG / PNG）
 *
 * 不引库：SVG 序列化注入 XML 声明 + 命名空间；PNG 走 Image + canvas。
 * blob URL 不会 taint canvas，安全。
 */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
/** 无尺寸信息时的降级默认值（mermaid 通常会设 viewBox，此为兜底） */
const DEFAULT_EXPORT_SIZE = { width: 400, height: 300 };

/**
 * 序列化 SVG 字符串：注入 XML 声明与 SVG 命名空间。
 *
 * 独立打开的 SVG 文件需要命名空间声明，否则浏览器不识别。
 * 已有 xmlns 时不重复注入。
 */
export function serializeSvg(svg: string): string {
    const hasNamespace = svg.includes(`xmlns="${SVG_NAMESPACE}"`);
    const withNamespace = hasNamespace
        ? svg
        : svg.replace(/^<svg/, `<svg xmlns="${SVG_NAMESPACE}"`);
    return `${XML_DECLARATION}\n${withNamespace}`;
}

/**
 * 从 SVG 字符串解析输出尺寸。优先取 viewBox，其次 width/height 属性，
 * 无则降级默认值。
 */
export function parseViewBoxSize(svg: string): { width: number; height: number } {
    const viewBox = svg.match(/viewBox="[\d.\s-]+\s([\d.]+)\s([\d.]+)"/);
    if (viewBox?.[1] && viewBox?.[2]) {
        return { width: Number.parseFloat(viewBox[1]), height: Number.parseFloat(viewBox[2]) };
    }
    const widthMatch = svg.match(/\bwidth="([\d.]+)"/);
    const heightMatch = svg.match(/\bheight="([\d.]+)"/);
    if (widthMatch?.[1] && heightMatch?.[1]) {
        return {
            width: Number.parseFloat(widthMatch[1]),
            height: Number.parseFloat(heightMatch[1]),
        };
    }
    return DEFAULT_EXPORT_SIZE;
}

/**
 * SVG 字符串 → PNG Blob。Image + canvas 路径，blob URL 不 taint canvas。
 *
 * @param svg 原始 SVG 字符串（函数内部序列化，含命名空间）
 * @returns PNG Blob
 */
export function svgToPngBlob(svg: string): Promise<Blob> {
    const { width, height } = parseViewBoxSize(svg);
    const svgString = serializeSvg(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error("canvas 2d context 不可用"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("canvas.toBlob 失败"));
            }, "image/png");
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("SVG 加载失败"));
        };
        img.src = url;
    });
}

/**
 * 触发浏览器下载：Blob → objectURL → <a download> click → revoke。
 *
 * 创建临时 <a> 挂载到 body、触发 click、立即移除。
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/** 导出 SVG 文件 */
export function exportSvg(svg: string, filename = "diagram.svg"): void {
    const serialized = serializeSvg(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, filename);
}

/** 导出 PNG 文件 */
export async function exportPng(svg: string, filename = "diagram.png"): Promise<void> {
    const blob = await svgToPngBlob(svg);
    downloadBlob(blob, filename);
}
