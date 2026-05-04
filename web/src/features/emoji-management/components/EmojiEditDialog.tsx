import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getEmojiDisplay } from "@/hooks/useEmojisAdmin";
import { Loader2 } from "lucide-react";
import type { EmojiAdmin, CreateEmojiInput } from "../types";

interface EmojiEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emoji: EmojiAdmin | null;
  form: CreateEmojiInput;
  onFormChange: (form: CreateEmojiInput) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EmojiEditDialog({
  open,
  onOpenChange,
  emoji,
  form,
  onFormChange,
  onSave,
  isSaving,
}: EmojiEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑表情</DialogTitle>
          <DialogDescription>修改表情的名称和内容</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {emoji && (
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-lg border flex items-center justify-center bg-muted/50">
                {emoji.url ? (
                  <img
                    src={getEmojiDisplay(emoji)}
                    alt={emoji.name}
                    className="w-full h-full rounded-lg object-contain"
                  />
                ) : (
                  <span className="text-3xl">
                    {emoji.textContent || emoji.name}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">名称</label>
            <Input
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="表情名称"
            />
          </div>

          {emoji?.url ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">图片链接</label>
              <Input
                value={form.url}
                onChange={(e) => onFormChange({ ...form, url: e.target.value })}
                placeholder="URL"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">文本内容</label>
              <Input
                value={form.textContent}
                onChange={(e) =>
                  onFormChange({ ...form, textContent: e.target.value })
                }
                placeholder="文本内容"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
