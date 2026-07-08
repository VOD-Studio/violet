import { create } from "zustand";

/**
 * ViewTransitionCoverStore — 共享元素过渡的跨路由协调状态
 *
 * 作用：让 PostCard（列表）和 BlogDetailPage（详情）的封面图在导航时
 * 使用相同的 view-transition-name，浏览器自动 morph 位置和尺寸。
 *
 * 工作流：
 * 1. 点击 PostCard 封面 → setSharedCoverSlug(slug)
 * 2. React flush 后该卡片的封面 DOM 获得 view-transition-name: post-cover
 * 3. TanStack Router 的 startViewTransition 捕获旧帧（卡片封面有 name）
 * 4. DOM 更新为详情页，封面也有 view-transition-name: post-cover
 * 5. 浏览器捕获新帧 → morph
 *
 * 返回时 store 仍持有 slug，列表页对应卡片自动获得 name，反向 morph 同样成立。
 */
interface ViewTransitionCoverState {
    /** 当前参与共享过渡的文章 slug（null 表示无） */
    sharedCoverSlug: string | null;
    /** 设置参与共享过渡的 slug */
    setSharedCoverSlug: (slug: string | null) => void;
}

export const useViewTransitionStore = create<ViewTransitionCoverState>((set) => ({
    sharedCoverSlug: null,
    setSharedCoverSlug: (slug) => set({ sharedCoverSlug: slug }),
}));
