import { useCallback, useSyncExternalStore } from "react";

/** 主题选择：light / dark / system。 */
export type ThemeChoice = "light" | "dark" | "system";

export interface UseThemeResult {
	/** 当前选择（system 时未解析）。 */
	theme: ThemeChoice;
	/** system 解析后的实际明暗。 */
	resolvedTheme: "light" | "dark";
	setTheme(theme: ThemeChoice): void;
}

const STORAGE_KEY = "violet-theme";

interface ThemeState {
	theme: ThemeChoice;
	resolvedTheme: "light" | "dark";
}

const listeners = new Set<() => void>();
let initialized = false;
let state: ThemeState = { theme: "system", resolvedTheme: "light" };

function isThemeChoice(value: unknown): value is ThemeChoice {
	return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemeChoice | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isThemeChoice(stored) ? stored : null;
	} catch {
		return null;
	}
}

function resolveTheme(theme: ThemeChoice): "light" | "dark" {
	if (theme !== "system") return theme;
	if (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark";
	}
	return "light";
}

function applyThemeToDocument(resolved: "light" | "dark"): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", resolved === "dark");
}

function publish(theme: ThemeChoice): void {
	const resolvedTheme = resolveTheme(theme);
	state = { theme, resolvedTheme };
	applyThemeToDocument(resolvedTheme);
	for (const listener of listeners) listener();
}

function persist(theme: ThemeChoice): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// 持久化失败时仅影响下次启动的初始值，不影响本次会话。
	}
}

function ensureInitialized(defaultTheme: ThemeChoice = "system"): void {
	if (initialized || typeof window === "undefined") return;
	initialized = true;
	publish(readStoredTheme() ?? defaultTheme);
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		// 仅 system 选择需要响应系统偏好变化。
		if (state.theme === "system") publish("system");
	});
}

function subscribe(listener: () => void): () => void {
	ensureInitialized();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
function getServerSnapshot(): ThemeState {
	return state;
}

function getSnapshot(): ThemeState {
	ensureInitialized();
	return state;
}

function setTheme(theme: ThemeChoice): void {
	ensureInitialized();
	publish(theme);
	persist(theme);
}

/**
 * 管理 light/dark/system 三态主题并同步到 <html> 的 dark 类。
 *
 * @remarks 初始值读取 localStorage["violet-theme"]（无效时回退 defaultTheme）；
 * system 经 prefers-color-scheme 解析并监听变化。同页多实例共享同一模块级状态。
 * SSR 环境下安全（不触碰 document/localStorage/matchMedia）。
 */
export function useTheme(defaultTheme: ThemeChoice = "system"): UseThemeResult {
	ensureInitialized(defaultTheme);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	const update = useCallback((next: ThemeChoice) => {
		setTheme(next);
	}, []);
	return {
		theme: snapshot.theme,
		resolvedTheme: snapshot.resolvedTheme,
		setTheme: update,
	};
}
