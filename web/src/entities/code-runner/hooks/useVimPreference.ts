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
	const [vimEnabled, setEnabled] = useState(readStored);

	const setVimEnabled = useCallback((enabled: boolean) => {
		setEnabled(enabled);
		try {
			localStorage.setItem(STORAGE_KEY, String(enabled));
		} catch {
			// 禁止本机存储时仍保留本页内的设置。
		}
	}, []);

	return { vimEnabled, setVimEnabled };
}
