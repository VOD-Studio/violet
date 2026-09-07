import { useEffect, useRef } from "react";

/** 保持全局保存快捷键指向最新编辑状态，避免重复绑定监听器。 */
export function usePersonaSaveShortcut(onSave: () => void) {
	const saveRef = useRef(onSave);

	useEffect(() => {
		saveRef.current = onSave;
	});
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				saveRef.current();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}
