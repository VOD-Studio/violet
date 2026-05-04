/**
 * 评论表情反应栏组件
 * 显示评论的表情反应统计，支持添加/删除表情反应
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EmojiButton } from "./EmojiButton";
import { useEmojis } from "@/hooks/useEmojis";
import { getUploadUrl } from "@/lib/api";
import {
  useCommentReactions,
  useAddReaction,
  useRemoveReaction,
} from "../hooks/useCommentReactions";
import type { CommentReaction } from "../types";

interface ReactionBarProps {
  /** 评论 ID */
  commentId: string;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 表情反应按钮组件
 */
const ReactionButton = memo(
  ({
    reaction,
    isProcessing,
    onClick,
  }: {
    reaction: CommentReaction;
    isProcessing: boolean;
    onClick: () => void;
  }) => {
    return (
      <button
        onClick={onClick}
        disabled={isProcessing}
        className={cn(
          "flex items-center gap-1.5 px-2.5 h-7 rounded-full",
          "border transition-all active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          reaction.user_reacted
            ? "bg-primary/10 border-primary text-primary hover:bg-primary/20 shadow-sm"
            : "bg-muted/50 border-border hover:border-primary/50 hover:bg-muted"
        )}
        title={`${reaction.user_reacted ? "取消" : "添加"} ${reaction.emoji_name} (${reaction.count})`}
        aria-label={`${reaction.user_reacted ? "取消" : "添加"} ${reaction.emoji_name} 反应`}
      >
        {/* 表情图标或文本 */}
        {reaction.emoji_url ? (
          <img
            src={getUploadUrl(reaction.emoji_url)}
            alt={reaction.emoji_name}
            className="w-4 h-4 object-contain"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              const fallback = reaction.text_content || reaction.emoji_name;
              target.style.display = "none";
              const span = document.createElement("span");
              span.className = "text-sm leading-none";
              span.textContent = fallback;
              target.parentNode?.appendChild(span);
            }}
          />
        ) : reaction.text_content ? (
          <span className="text-sm leading-none">{reaction.text_content}</span>
        ) : (
          <span className="text-sm leading-none">{reaction.emoji_name}</span>
        )}

        {/* 反应计数 */}
        <span className="text-xs font-medium tabular-nums">
          {reaction.count}
        </span>
      </button>
    );
  }
);

ReactionButton.displayName = "ReactionButton";

/**
 * 评论表情反应栏
 * 显示已有的表情反应，支持添加/删除
 */
export const ReactionBar = memo(({ commentId, className }: ReactionBarProps) => {
  // 直接使用 useCommentReactions Hook 获取实时数据
  const { data } = useCommentReactions(commentId);
  const reactions = data?.reactions || [];
  const { groups } = useEmojis();
  const addMutation = useAddReaction(commentId);
  const removeMutation = useRemoveReaction(commentId);

  const isProcessing = addMutation.isPending || removeMutation.isPending;

  /**
   * 处理表情反应点击
   */
  const handleReactionClick = useCallback(
    (reaction: CommentReaction) => {
      if (isProcessing) return;

      if (reaction.user_reacted) {
        removeMutation.mutate(reaction.emoji_id);
      } else {
        addMutation.mutate(reaction.emoji_id);
      }
    },
    [isProcessing, addMutation, removeMutation]
  );

  /**
   * 处理表情选择
   */
  const handleEmojiSelect = useCallback(
    (emojiName: string) => {
      // 从所有表情分组中查找对应的表情 ID
      let emojiId: number | null = null;
      for (const group of groups) {
        const emoji = group.emojis?.find((e) => e.name === emojiName);
        if (emoji) {
          emojiId = emoji.id;
          break;
        }
      }

      if (emojiId === null) {
        console.warn("未找到表情 ID:", emojiName);
        return;
      }

      addMutation.mutate(emojiId);
    },
    [groups, addMutation]
  );

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* 已有的表情反应 */}
      {reactions.map((reaction) => (
        <ReactionButton
          key={reaction.emoji_id}
          reaction={reaction}
          isProcessing={isProcessing}
          onClick={() => handleReactionClick(reaction)}
        />
      ))}

      {/* 添加表情按钮 */}
      <EmojiButton onSelect={handleEmojiSelect} disabled={isProcessing} />
    </div>
  );
});

ReactionBar.displayName = "ReactionBar";
