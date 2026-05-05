// 快捷评论组件
// 悬浮按钮 + 抽屉，当评论区还没进入视口时显示
// 从 store 获取 postId 和 hasReachedComments 状态

import { useState } from "react";
import { usePostStore } from "@/store";
import { QuickCommentButton } from "./QuickCommentButton";
import { QuickCommentDrawer } from "./QuickCommentDrawer";

/**
 * 快捷评论组件
 * 当评论区未进入视口时显示悬浮按钮，方便快速评论
 * 滚动到评论区后隐藏，因为已有发表评论表单
 */
export function QuickComment() {
  const [showDrawer, setShowDrawer] = useState(false);
  const { postId, hasReachedComments } = usePostStore();

  // 非文章页面不显示按钮
  if (!postId) return null;

  // 已到达评论区（能看到发表评论表单）时不显示按钮
  const visible = !hasReachedComments;

  return (
    <>
      <QuickCommentButton
        visible={visible}
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
