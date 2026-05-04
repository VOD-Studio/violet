/**
 * 评论表情反应 Context
 * 提供批量查询的反应数据给所有子组件
 */

import { createContext, useContext, type ReactNode } from "react";
import type { CommentReaction } from "../types";

interface CommentReactionsContextValue {
  /** commentId -> reactions 的映射 */
  reactionsMap: Record<string, CommentReaction[]>;
  /** 是否正在加载 */
  isLoading: boolean;
}

const CommentReactionsContext = createContext<
  CommentReactionsContextValue | undefined
>(undefined);

interface CommentReactionsProviderProps {
  children: ReactNode;
  reactionsMap: Record<string, CommentReaction[]>;
  isLoading: boolean;
}

/**
 * 评论反应数据提供者
 * 在顶层批量查询后，通过 Context 向下传递数据
 */
export function CommentReactionsProvider({
  children,
  reactionsMap,
  isLoading,
}: CommentReactionsProviderProps) {
  return (
    <CommentReactionsContext.Provider value={{ reactionsMap, isLoading }}>
      {children}
    </CommentReactionsContext.Provider>
  );
}

/**
 * 获取评论反应数据的 Hook
 * @param commentId 评论 ID
 * @returns 该评论的反应数据
 */
export function useCommentReactionsContext(commentId: string) {
  const context = useContext(CommentReactionsContext);

  if (!context) {
    throw new Error(
      "useCommentReactionsContext must be used within CommentReactionsProvider"
    );
  }

  return {
    reactions: context.reactionsMap[commentId] || [],
    isLoading: context.isLoading,
  };
}
