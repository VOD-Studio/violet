import { useSyncExternalStore } from "react";
import type { Emoji } from "./types";

const STORAGE_KEY = "violet:recent-emojis";
const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
let snapshot: readonly string[] = EMPTY;
let storedValue: string | null | undefined;

/** 系统 ID 与自定义 UUID 不共用键空间。 */
export function emojiKey(emoji: Emoji): string {
	return emoji.custom_emoji_id ? `custom:${emoji.custom_emoji_id}` : `system:${emoji.id}`;
}

function readSnapshot(): readonly string[] {
	if (typeof window === "undefined") {
		return EMPTY;
	}
	let value: string | null;
	try {
		value = window.localStorage.getItem(STORAGE_KEY);
	} catch {
		return snapshot;
	}
	if (value === storedValue) {
		return snapshot;
	}
	storedValue = value;
	try {
		const saved: unknown = JSON.parse(value ?? "[]");
		if (Array.isArray(saved)) {
			const valid = saved.filter(
				(key): key is string =>
					typeof key === "string" && /^(system:\d+|custom:[\w-]+)$/.test(key),
			);
			snapshot = [...new Set(valid)].slice(0, 16);
		} else {
			snapshot = EMPTY;
		}
	} catch {
		snapshot = EMPTY;
	}
	return snapshot;
}

function receive(event: StorageEvent) {
	if (event.key !== null && event.key !== STORAGE_KEY) {
		return;
	}
	readSnapshot();
	for (const notify of listeners) {
		notify();
	}
}

function subscribe(listener: () => void) {
	if (listeners.size === 0) {
		window.addEventListener("storage", receive);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", receive);
		}
	};
}

/** 本机最近十六个；输入与回应共用，由当前可用目录解析具体条目。 */
export function useRecentEmojiKeys(): readonly string[] {
	return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
}

/** 只记录真实选择；存储写入失败时仍保留本页会话中的记录。 */
export function rememberEmoji(emoji: Emoji): void {
	readSnapshot();
	const key = emojiKey(emoji);
	snapshot = [key, ...snapshot.filter((entry) => entry !== key)].slice(0, 16);
	try {
		const value = JSON.stringify(snapshot);
		window.localStorage.setItem(STORAGE_KEY, value);
		storedValue = value;
	} catch {
		// 存储被禁用或配额已满时，不阻断当前选择。
	}
	for (const notify of listeners) {
		notify();
	}
}
