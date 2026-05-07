import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

interface ImportPlaylistDialogProps {
  url: string;
  importing: boolean;
  onUrlChange: (url: string) => void;
  onImport: () => void;
  onCreateCustom: () => void;
}

export function ImportPlaylistDialog({
  url,
  importing,
  onUrlChange,
  onImport,
  onCreateCustom,
}: ImportPlaylistDialogProps) {
  return (
    <div className="flex gap-2">
      <Input
        placeholder="粘贴歌单链接，如 music.163.com/playlist?id=xxx"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        className="flex-1"
      />
      <Button onClick={onImport} disabled={importing}>
        {importing ? <Loader2 className="size-4 animate-spin" /> : "导入"}
      </Button>
      <div className="mx-1 w-px bg-border" />
      <Button variant="outline" onClick={onCreateCustom}>
        <Plus className="size-4" />
        创建歌单
      </Button>
    </div>
  );
}

interface CreateCustomPlaylistDialogProps {
  open: boolean;
  title: string;
  creating: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (title: string) => void;
  onCreate: () => void;
}

export function CreateCustomPlaylistDialog({
  open,
  title,
  creating,
  onOpenChange,
  onTitleChange,
  onCreate,
}: CreateCustomPlaylistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建自定义歌单</DialogTitle>
          <DialogDescription>
            创建空白歌单后，可以手动上传音频文件
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="输入歌单名称"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate();
            }}
          />
          <Button onClick={onCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : "创建"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
