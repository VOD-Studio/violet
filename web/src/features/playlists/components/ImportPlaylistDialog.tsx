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

/** ImportPlaylistDialog 组件的属性 */
interface ImportPlaylistDialogProps {
  /** 歌单 URL */
  url: string;
  /** 是否正在导入 */
  importing: boolean;
  /** URL 变化回调 */
  onUrlChange: (url: string) => void;
  /** 导入回调 */
  onImport: () => void;
  /** 创建自定义歌单回调 */
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

/** CreateCustomPlaylistDialog 组件的属性 */
interface CreateCustomPlaylistDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 歌单标题 */
  title: string;
  /** 是否正在创建 */
  creating: boolean;
  /** 打开/关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 标题变化回调 */
  onTitleChange: (title: string) => void;
  /** 创建回调 */
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
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
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
