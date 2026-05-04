/**
 * 回复指示器组件
 * 显示"回复 @用户名"提示条
 */

import { motion } from "motion/react";
import { X } from "lucide-react";

interface ReplyIndicatorProps {
  /** 回复目标用户名 */
  replyTo: string;
  /** 取消回复回调 */
  onCancel: () => void;
}

/**
 * 回复指示器
 * 带淡入动画的提示条
 */
export function ReplyIndicator({ replyTo, onCancel }: ReplyIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border"
    >
      <span className="text-sm text-muted-foreground">
        回复 <span className="font-medium text-foreground">{replyTo}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded hover:bg-background transition-colors"
        title="取消回复"
        aria-label="取消回复"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
