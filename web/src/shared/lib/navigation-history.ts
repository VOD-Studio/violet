const SCROLL_KEY_PREFIX = "violet-scroll:";

export function rememberScrollPosition(key: string): void {
	if (typeof window === "undefined") return;
	sessionStorage.setItem(`${SCROLL_KEY_PREFIX}${key}`, String(window.scrollY));
}

export function restoreScrollPosition(key: string): void {
	if (typeof window === "undefined") return;
	const value = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${key}`);
	if (value === null) return;
	const y = Number(value);
	if (Number.isFinite(y)) {
		requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
	}
	sessionStorage.removeItem(`${SCROLL_KEY_PREFIX}${key}`);
}
