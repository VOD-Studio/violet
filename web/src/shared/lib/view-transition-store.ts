import { create } from "zustand";

/**
 * 共享元素 morph 的跨路由协调状态
 *
 * 仅 blog list ↔ detail 导航时生效：
 * 1. 点击 PostCard 封面 → setSharedCoverSlug(slug)
 * 2. 该卡片获得 view-transition-name: post-cover（同名唯一）
 * 3. 详情页封面始终携带同名 → 浏览器 morph
 *
 * 清理时机：router types 回调在导航离开博客段时自动清零，
 * 避免其他页面出现残留 VT name 导致诡异飞入动画。
 */
interface ViewTransitionCoverState {
	sharedCoverSlug: string | null;
	setSharedCoverSlug: (slug: string | null) => void;
}

export const useViewTransitionStore = create<ViewTransitionCoverState>((set) => ({
	sharedCoverSlug: null,
	setSharedCoverSlug: (slug) => set({ sharedCoverSlug: slug }),
}));
