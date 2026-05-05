// 快捷评论抽屉组件
// 包含评论表单，支持已登录用户自动填充

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store";
import { EmojiButton, useSubmitComment } from "@/features/comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

interface QuickCommentDrawerProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 快捷评论抽屉
 * 提供简洁的评论表单，支持表情选择
 */
export function QuickCommentDrawer({
  postId,
  open,
  onOpenChange,
}: QuickCommentDrawerProps) {
  const submitMutation = useSubmitComment(postId);
  const { user } = useAuthStore();

  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");

  // 已登录用户自动填充用户名和邮箱
  useEffect(() => {
    if (user) {
      setAuthorName(user.username || "");
      setAuthorEmail(user.email || "");
    }
  }, [user]);

  // 重置表单
  const resetForm = () => {
    setContent("");
  };

  /**
   * 处理评论提交
   */
  async function handleSubmit() {
    if (!authorName.trim() || !content.trim()) return;

    try {
      await submitMutation.mutateAsync({
        author_name: authorName.trim(),
        author_email: authorEmail.trim() || undefined,
        body: content.trim(),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      /* 错误由 mutation 处理 */
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>发表评论</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col h-full"
        >
          <div className="flex-1 space-y-6 py-6">
            {/* 已登录用户显示用户信息 */}
            {user ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>以</span>
                <span className="font-medium text-foreground">
                  {user.username}
                </span>
                <span>的身份发表评论</span>
              </div>
            ) : (
              /* 未登录用户需要输入名称和邮箱 */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-name">名称 *</Label>
                  <Input
                    id="quick-name"
                    placeholder="你的名称"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-email">邮箱（可选）</Label>
                  <Input
                    id="quick-email"
                    type="email"
                    placeholder="你的邮箱"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* 评论内容 */}
            <div className="space-y-2">
              <Label htmlFor="quick-content">评论内容 *</Label>
              <div className="relative">
                <Textarea
                  id="quick-content"
                  placeholder="写下你的评论..."
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="resize-none"
                />
                {/* 表情选择器按钮 */}
                <div className="absolute bottom-2 right-2">
                  <EmojiButton
                    onSelect={(name: string) => {
                      setContent((prev) => prev + `[${name}]`);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 提交错误提示 */}
            {submitMutation.error && (
              <p className="text-sm text-destructive">
                {submitMutation.error.message}
              </p>
            )}
          </div>

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                submitMutation.isPending ||
                (!user && !authorName.trim()) ||
                !content.trim()
              }
            >
              {submitMutation.isPending ? "提交中..." : "发表"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
