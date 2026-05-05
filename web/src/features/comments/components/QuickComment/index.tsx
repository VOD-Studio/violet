// 快捷评论组件
// 悬浮按钮 + 抽屉，当评论区还没进入视口时显示
// 从 store 获取 postId 和 hasReachedComments 状态

import { useState } from "react";
import { usePostStore } from "@/store";
import { QuickCommentButton } from "./QuickCommentButton";
import { QuickCommentDrawer } from "./QuickCommentDrawer";

/**
 * 快捷评论组件
 * 仅在文章页面且未滚动到评论区时显示悬浮按钮
 */
export function QuickComment() {
  const [showDrawer, setShowDrawer] = useState(false);
  const { postId, hasReachedComments } = usePostStore();

  // 非文章页面或已到达评论区时不显示按钮
  if (!postId || hasReachedComments) return null;

  return (
    <>
      <QuickCommentButton
        visible={true}
        onClick={() => setShowDrawer(true)}
      />
      <QuickCommentDrawer
        postId={postId}
        open={showDrawer}
        onOpenChange={setShowDrawer}
      />
    </>
  );
}