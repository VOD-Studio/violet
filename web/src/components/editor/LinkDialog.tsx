/**
 * 链接插入对话框
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string, text?: string) => void;
  initialUrl?: string;
}

export function LinkDialog({
  open,
  onClose,
  onInsert,
  initialUrl,
}: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState("");

  function handleInsert() {
    if (!url.trim()) return;
    onInsert(url.trim(), text.trim() || undefined);
    setUrl("");
    setText("");
    onClose();
  }

  function handleClose() {
    setUrl("");
    setText("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>插入链接</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">链接地址</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-text">显示文本（可选）</Label>
            <Input
              id="link-text"
              placeholder="链接显示的文字"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            插入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
