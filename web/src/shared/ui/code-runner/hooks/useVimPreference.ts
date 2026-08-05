/**
 * useVimPreference - Vim 模式偏好持久化
 *
 * 默认开启（与 yggdrasil 一致），key 为 violet-code-runner-vim。
 * 切换时同步写入 localStorage。
 */
import { useCallback, useState } from "react";

const STORAGE_KEY = "violet-code-runner-vim";

function readStored(): boolean {
	try {
		const val = localStorage.getItem(STORAGE_KEY);
		if (val === null) return true; // 默认开启
		return val === "true";
	} catch {
		return true; // localStorage 不可用时默认开启
	}
}

export function useVimPreference() {
	const [vimEnabled, setVimEnabled] = useState(readStored);

	const toggle = useCallback(() => {
		setVimEnabled((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(STORAGE_KEY, String(next));
			} catch {
				// 写入失败不影响内存状态
			}
			return next;
		});
	}, []);

	return { vimEnabled, toggleVim: toggle };
}
