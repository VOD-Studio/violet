// 快捷评论悬浮按钮组件
// 当评论区还没进入视口时显示，方便用户快速发表评论

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickCommentButtonProps {
  onClick: () => void;
  visible: boolean;
}

/**
 * 快捷评论悬浮按钮
 * 固定在页面右下角，点击打开评论对话框
 */
export function QuickCommentButton({
  onClick,
  visible,
}: QuickCommentButtonProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-36 right-4 z-40">
      <Button
        size="lg"
        className="shadow-lg rounded-full"
        onClick={onClick}
      >
        <MessageSquare className="mr-2 h-5 w-5" />
        发表评论
      </Button>
    </div>
  );
}