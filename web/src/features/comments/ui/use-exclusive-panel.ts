import { useEffect } from "react";
import { create } from "zustand";

/** 批注相关的浮层种类：同一时刻只允许其中一个打开 */
export type PanelKind = "popover" | "selection" | "block";

interface PanelState {
	active: PanelKind | null;
	open: (kind: PanelKind) => void;
	close: (kind: PanelKind) => void;
}

const usePanelStore = create<PanelState>((set) => ({
	active: null,
	open: (kind) => set({ active: kind }),
	close: (kind) => set((s) => (s.active === kind ? { active: null } : s)),
}));

/**
 * 让批注浮层互斥：自己打开时占用，别的浮层随后打开则调用 dismiss 让位。
 *
 * @param kind - 本浮层的种类
 * @param isOpen - 本浮层当前是否打开
 * @param dismiss - 被别的浮层顶替时关闭自己的回调，需保持引用稳定
 */
export function useExclusivePanel(kind: PanelKind, isOpen: boolean, dismiss: () => void): void {
	const active = usePanelStore((s) => s.active);

	useEffect(() => {
		const { open, close } = usePanelStore.getState();
		if (isOpen) open(kind);
		else close(kind);
	}, [isOpen, kind]);

	useEffect(() => {
		if (isOpen && active !== null && active !== kind) dismiss();
	}, [active, isOpen, kind, dismiss]);
}
