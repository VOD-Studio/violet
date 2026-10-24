/**
 * 站点 CSS 变量探针与色值换算的共享底层：
 * 读任意明暗作用域的 CSS 变量、任意 CSS 颜色转 hex。
 */

/**
 * 将浏览器能够解析的颜色转换为不含透明度的六位十六进制颜色。
 *
 * @param color - CSS 颜色值；十六进制输入无需创建 DOM 探针。
 * @returns 转换结果；空值、无法解析的色值或 SSR 下的非十六进制输入返回 null。
 */
export function cssColorToHex(color: string | undefined | null): string | null {
	return cssColorsToHex([color])[0];
}

function cssColorsToHex(colors: readonly (string | undefined | null)[]): (string | null)[] {
	const fragment = typeof document === "undefined" ? null : document.createDocumentFragment();
	const entries = colors.map((color) => {
		const value = color?.trim();
		if (!value) return null;
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return value.slice(0, 7).toLowerCase();
		if (!fragment) return null;
		const probe = document.createElement("span");
		probe.style.color = value;
		probe.style.display = "none";
		fragment.appendChild(probe);
		return probe;
	});
	if (fragment) document.documentElement.appendChild(fragment);
	const results = entries.map((entry) =>
		typeof entry === "string" || entry === null
			? entry
			: computedColorToHex(window.getComputedStyle(entry).color),
	);
	for (const entry of entries) {
		if (entry && typeof entry !== "string") entry.remove();
	}
	return results;
}

function computedColorToHex(computed: string): string | null {
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

const probes = new Map<string, HTMLSpanElement>();

/**
 * 读取站点颜色变量在指定明暗域的解析值。
 *
 * @param name - 包含双连字符前缀的 CSS 自定义属性名。
 * @param isDark - 显式指定探针的 color-scheme，不依赖页面当前主题。
 * @returns 解析后的颜色字符串；SSR 或变量不存在时返回空字符串。
 * @remarks 探针按变量与明暗域复用，但每次读取当前样式，不缓存可能过期的主题值。
 */
export function readSiteVar(name: string, isDark: boolean): string {
	return readSiteVars([name], isDark)[name];
}

function readSiteVars(names: readonly string[], isDark: boolean): Record<string, string> {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return Object.fromEntries(names.map((name) => [name, ""]));
	}
	const targets = names.map((name) => {
		const key = `${isDark ? "dark" : "light"}:${name}`;
		let probe = probes.get(key);
		if (!probe?.isConnected) {
			probe = document.createElement("span");
			probe.style.display = "none";
			probe.style.setProperty("color-scheme", isDark ? "dark" : "light");
			probe.style.backgroundColor = `var(${name})`;
			probe.setAttribute("aria-hidden", "true");
			document.documentElement.appendChild(probe);
			probes.set(key, probe);
		}
		return { name, probe };
	});
	// 先完成所有探针写入，再集中读取已解析颜色，避免逐变量交替读写触发样式刷新。
	return Object.fromEntries(
		targets.map(({ name, probe }) => {
			const computed = window.getComputedStyle(probe);
			return [
				name,
				computed.getPropertyValue(name).trim()
					? (computed.backgroundColor ?? "").trim()
					: "",
			];
		}),
	);
}

/**
 * 分批读取站点颜色并转换为六位十六进制结果。
 *
 * @param names - 包含双连字符前缀的 CSS 颜色变量名。
 * @param isDark - 指定解析的明暗域，与页面当前主题无关。
 * @returns 按变量名索引的颜色；缺失、无法转换或 SSR 时对应值为 null。
 * @remarks 共用单值接口的探针与转换实现，每批先写后读，读取期间不切换根元素主题。
 */
export function readSiteColors(
	names: readonly string[],
	isDark: boolean,
): Record<string, string | null> {
	const values = readSiteVars(names, isDark);
	const colors = cssColorsToHex(names.map((name) => values[name]));
	return Object.fromEntries(names.map((name, index) => [name, colors[index]]));
}
