import { AvatarGroup } from "@shared/ui/avatar-group";
import { Button } from "@shared/ui/base/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/base/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@shared/ui/base/sheet";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
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
                    <SheetHeader className="px-6 pt-6 pb-4">
                        <SheetTitle className="flex items-center gap-2">
                            <History className="size-5" />
                            历史版本
                        </SheetTitle>
                        <SheetDescription>查看并恢复之前的文章快照</SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-col gap-3 px-6 pb-6">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        ) : versions?.length ? (
                            versions.map((v, index) => (
                                <div
                                    key={v.id}
                                    className="group relative overflow-hidden rounded-xl border bg-background p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg dark:hover:shadow-primary/5 animate-in slide-in-from-bottom-4 fade-in fill-mode-backwards"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                                    <div className="relative z-10 flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="font-medium text-foreground line-clamp-2 mt-1">
                                                {v.summary}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPreviewId(v.id)}
                                                className="h-8 shrink-0 rounded-full px-4 text-xs font-medium shadow-none transition-all hover:bg-primary hover:text-primary-foreground"
                                            >
                                                预览
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                                                <Clock className="size-3.5" />
                                                {new Date(v.created_at).toLocaleString()}
                                            </div>
                                            {v.editor ? (
                                                <div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                                                    <AvatarGroup users={[v.editor]} size="xs" />
                                                    {v.editor.username}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">暂无历史版本记录</p>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <VersionPreviewDialog
                postId={postId}
                versionId={previewId || ""}
                open={!!previewId}
                onClose={() => setPreviewId(null)}
                onRestored={() => {
                    setPreviewId(null);
                    onOpenChange(false);
                    onRestored?.();
                }}
            />
        </>
    );
}

function VersionPreviewDialog({
    postId,
    versionId,
    open,
    onClose,
    onRestored,
}: {
    postId: string;
    versionId: string;
    open: boolean;
    onClose: () => void;
    onRestored: () => void;
}) {
    const { data, isLoading } = usePostVersion(versionId);
    const restoreMut = useRestoreVersion(postId, versionId);

    const handleRestore = () => {
        if (!versionId) return;
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
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-4xl sm:max-w-4xl lg:max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl border-border/50 shadow-2xl">
                <DialogHeader className="border-b bg-muted/20 p-6">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <History className="size-5 text-primary" />
                        版本内容预览
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-background/50">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center p-12">
                            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                                <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                                <p className="text-sm text-muted-foreground">正在加载版本内容...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {data?.content_md ? (
                                <ArticleContent content={data.content_md} />
                            ) : (
                                <span className="italic text-muted-foreground">无内容</span>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter className="border-t bg-muted/20 p-4 px-6 mt-0">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={restoreMut.isPending}
                        className="rounded-full"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleRestore}
                        disabled={isLoading || restoreMut.isPending}
                        className="rounded-full shadow-md transition-all hover:shadow-lg"
                    >
                        {restoreMut.isPending ? "恢复中..." : "恢复至此版本"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
