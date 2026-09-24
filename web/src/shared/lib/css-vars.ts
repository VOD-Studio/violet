/**
 * 站点 CSS 变量探针与色值换算的共享底层：
 * 读任意明暗作用域的 CSS 变量、任意 CSS 颜色转 hex。
 * 消费方：mermaid 主题映射、营造法式 token 探针。
 */

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

let lightProbe: HTMLSpanElement | null = null;
let darkProbe: HTMLSpanElement | null = null;

/**
 * readSiteVar - 读站点 CSS 变量，按 isDark 选浅/深变体
 *
 * 探针带 .dark 类时，.dark { --x: ... } 规则直接作用于该元素，读到暗色值；
 * 不带类时读到 :root 的浅色值。与 <html> 当前主题解耦。
 * 营造法式的 token 词典复用此探针读取明暗双域实时值。
 */
export function readSiteVar(name: string, isDark: boolean): string {
	if (typeof window === "undefined" || typeof document === "undefined") return "";
	// 探针常驻复用：循环调用(如 token 词典逐 token 读取)时避免上百次
	// 「插入 → 强制样式计算 → 移除」阻塞主线程；断线(测试重建 DOM)则重建
	let probe = isDark ? darkProbe : lightProbe;
	if (!probe?.isConnected) {
		probe = document.createElement("span");
		if (isDark) probe.className = "dark";
		probe.style.display = "none";
		probe.setAttribute("aria-hidden", "true");
		document.documentElement.appendChild(probe);
		if (isDark) darkProbe = probe;
		else lightProbe = probe;
	}
	return window.getComputedStyle(probe).getPropertyValue(name).trim();
}
