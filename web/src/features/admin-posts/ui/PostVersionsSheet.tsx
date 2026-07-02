import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@shared/ui/sheet";
import { Clock, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRestoreVersion } from "../api/mutations";
import { usePostVersion, usePostVersions } from "../api/queries";

interface PostVersionsSheetProps {
    postId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRestored?: () => void;
}

export function PostVersionsSheet({
    postId,
    open,
    onOpenChange,
    onRestored,
}: PostVersionsSheetProps) {
    const { data: versions, isLoading } = usePostVersions(postId);
    const [previewId, setPreviewId] = useState<string | null>(null);

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-100 sm:w-120 overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-2">
                            <History className="size-5" />
                            历史版本
                        </SheetTitle>
                        <SheetDescription>查看并恢复之前的文章快照</SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-col gap-4">
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">加载中...</p>
                        ) : versions?.length ? (
                            versions.map((v) => (
                                <div
                                    key={v.id}
                                    className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">{v.summary}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPreviewId(v.id)}
                                        >
                                            预览
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {new Date(v.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">暂无历史版本记录</p>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {previewId && (
                <VersionPreviewDialog
                    postId={postId}
                    versionId={previewId}
                    onClose={() => setPreviewId(null)}
                    onRestored={() => {
                        setPreviewId(null);
                        onOpenChange(false);
                        onRestored?.();
                    }}
                />
            )}
        </>
    );
}

function VersionPreviewDialog({
    postId,
    versionId,
    onClose,
    onRestored,
}: {
    postId: string;
    versionId: string;
    onClose: () => void;
    onRestored: () => void;
}) {
    const { data, isLoading } = usePostVersion(versionId);
    const restoreMut = useRestoreVersion(postId, versionId);

    const handleRestore = () => {
        restoreMut.mutate(undefined, {
            onSuccess: () => {
                toast.success("已成功恢复至该版本");
                onRestored();
            },
            onError: (err) => {
                toast.error(err.message || "恢复失败");
            },
        });
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>版本内容预览</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 border rounded-md bg-muted/30">
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">加载中...</p>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                            {data?.content_md || "无内容"}
                        </div>
                    )}
                </div>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={restoreMut.isPending}>
                        取消
                    </Button>
                    <Button onClick={handleRestore} disabled={isLoading || restoreMut.isPending}>
                        {restoreMut.isPending ? "恢复中..." : "恢复至此版本"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
