/** 去掉尾部斜杠，根路径保持 "/"。 */
function normalize(pathname: string): string[] {
	return pathname.split("/").filter(Boolean);
}

/**
 * 比较路径模式与实际路径：`$param` 匹配任意一段，尾部 `/*` 匹配该前缀及其下任意深度。
 *
 * @example
 * matchPattern("/blog/$slug", "/blog/hello"); // true
 * matchPattern("/ui/*", "/ui/components/button"); // true
 * matchPattern("/blog", "/blog/hello"); // false
 */
export function matchPattern(pattern: string, pathname: string): boolean {
	const want = normalize(pattern);
	const have = normalize(pathname);
	const rest = want.at(-1) === "*";
	if (rest) want.pop();
	if (rest ? have.length < want.length : have.length !== want.length) return false;
	return want.every((segment, index) => segment.startsWith("$") || segment === have[index]);
}

/** 路径是否命中模式列表中的任意一项。 */
export function matchesAny(patterns: readonly string[], pathname: string | undefined): boolean {
	return pathname !== undefined && patterns.some((pattern) => matchPattern(pattern, pathname));
}
