/**
 * copyText - 跨环境复制文本到剪贴板
 *
 * 优先使用现代 Clipboard API；在非安全上下文，如通过 IP 或自定义域名访问本地服务时，
 * 自动降级为 document.execCommand，保证本地联调仍可复制。
 */
export async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // 安全上下文下失败则继续尝试降级方案
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.setAttribute("aria-hidden", "true");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        // execCommand 已废弃，但在非安全上下文是唯一可用的复制降级方案
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}
