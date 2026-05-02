// 文章状态 slice
// 管理当前访问的文章 ID 和评论区可见状态
// 用于全局快捷评论组件获取上下文

import { create } from "zustand";

/** 文章状态接口 */
interface PostState {
  /** 当前文章 ID（仅在文章详情页时存在） */
  postId: string | null;
  /** 是否已滚动到评论区（true 时隐藏快捷评论按钮） */
  hasReachedComments: boolean;
  /** 设置当前文章 ID */
  setPostId: (id: string | null) => void;
  /** 设置评论区可见状态 */
  setHasReachedComments: (reached: boolean) => void;
}

/**
 * 文章状态 store
 * 不需要持久化，仅在会话期间有效
 */
export const usePostStore = create<PostState>()((set) => ({
  postId: null,
  hasReachedComments: false,

  setPostId: (postId) => set({ postId, hasReachedComments: false }),

  setHasReachedComments: (hasReachedComments) => set({ hasReachedComments }),
}));