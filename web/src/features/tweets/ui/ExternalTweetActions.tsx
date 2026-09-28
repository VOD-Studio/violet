import type { ExternalTweet } from "@entities/tweet/model/types";
import { Button } from "@shared/ui/base/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useManageExternalTweet } from "../api/mutations";

/** 持 tweet:delete-any 权限的用户管理所有转发共用的来源。 */
export interface ExternalTweetActionsProps {
	tweet: ExternalTweet;
}

export function ExternalTweetActions({ tweet }: ExternalTweetActionsProps) {
	const [confirm, setConfirm] = useState(false);
	const refresh = useManageExternalTweet(tweet.id, "refresh");
	const withdraw = useManageExternalTweet(tweet.id, "withdraw");
	return (
		<div
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			className="flex flex-wrap items-center gap-2"
		>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				disabled={refresh.isPending || withdraw.isPending}
				onClick={() =>
					refresh.mutate(undefined, {
						onSuccess: () => toast.success("原文已刷新"),
						onError: (err) => toast.error(err.message),
					})
				}
			>
				<RefreshCw className="size-3.5" />
				刷新原文
			</Button>
			{tweet.snapshot && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={refresh.isPending || withdraw.isPending}
					onClick={() => setConfirm(true)}
					className="text-destructive"
				>
					下架共享原文
				</Button>
			)}
			<ConfirmDialog
				open={confirm}
				onOpenChange={setConfirm}
				title="下架共享原文"
				description="所有本站转发和聊天分享将隐藏这条 X 原文，原文媒体会一并清理。本站感想与讨论保留。"
				confirmLabel="下架原文"
				loading={withdraw.isPending}
				onConfirm={() =>
					withdraw.mutate(undefined, {
						onSuccess: () => {
							setConfirm(false);
							toast.success("共享原文已下架");
						},
						onError: (err) => toast.error(err.message),
					})
				}
			/>
		</div>
	);
}
