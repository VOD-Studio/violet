import { toAvatarItem } from "@shared/lib/avatar-user";
import { formatDateTime } from "@shared/lib/date";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import {
	Avatar,
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Spinner,
} from "@violet/ui";
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
				<SheetContent size="lg">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<History className="size-5" />
							历史版本
						</SheetTitle>
						<SheetDescription>查看并恢复之前的文章快照</SheetDescription>
					</SheetHeader>

					<SheetBody className="flex flex-col gap-3">
						{isLoading ? (
							<div className="flex justify-center p-8">
								<Spinner size={24} className="text-primary" aria-hidden="true" />
							</div>
						) : versions?.length ? (
							versions.map((v) => (
								<div
									key={v.id}
									className="group relative overflow-hidden rounded-xl border bg-background p-4 transition-colors duration-300 hover:border-selected-foreground"
								>
									<div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

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
												{formatDateTime(v.created_at, "second")}
											</div>
											{v.editor ? (
												<div className="flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
													<Avatar
														{...toAvatarItem(v.editor)}
														alt=""
														size={24}
													/>
													{v.editor.display_name || v.editor.username}
												</div>
											) : null}
										</div>
									</div>
								</div>
							))
						) : (
							<p className="text-sm text-muted-foreground">暂无历史版本记录</p>
						)}
					</SheetBody>
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
			<DialogContent size="xl" className="h-[85dvh]" aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="size-5 text-primary" />
						版本内容预览
					</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{isLoading ? (
						<div className="flex h-full items-center justify-center p-12">
							<div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
								<Spinner size={32} className="text-primary" aria-hidden="true" />
								<p className="text-sm text-muted-foreground">正在加载版本内容...</p>
							</div>
						</div>
					) : (
						<div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
							{data?.content_md ? (
								<ArticleContent content={data.content_md} contentType="markdown" />
							) : (
								<span className="italic text-muted-foreground">无内容</span>
							)}
						</div>
					)}
				</DialogBody>
				<DialogFooter>
					<Button variant="secondary" onClick={onClose} disabled={restoreMut.isPending}>
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
