import { create } from "zustand";

/**
 * MusicUIState - 音乐播放器显隐状态
 *
 * MusicPlayer 是常驻 __root 的全屏小组件（非路由），
 * 由 Header 的 nav action 项调用 open() 切换。
 * 首期仅做骨架，实际播放下一期扩展。
 */
export interface MusicUIState {
	/** 是否打开 */
	isOpen: boolean;
	/** 打开播放器 */
	open: () => void;
	/** 关闭播放器 */
	close: () => void;
	/** 切换显隐 */
	toggle: () => void;
}

/**
 * useMusicUIStore - 音乐播放器 UI 状态 store
 *
 * 全局客户端状态，不持久化（每次刷新默认关闭）。
 * selector 消费避免无谓重渲染：useMusicUIStore(s => s.isOpen)
 */
export const useMusicUIStore = create<MusicUIState>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
