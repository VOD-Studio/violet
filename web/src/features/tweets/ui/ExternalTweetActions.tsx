import type { ExternalTweet } from "@entities/tweet/model/types";
import { ConfirmDialog, DropdownMenuItem } from "@violet/ui";
import { RefreshCw, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useManageExternalTweet } from "../api/mutations";
import { TweetMoreMenu } from "./TweetMoreMenu";

/** 持 tweet:delete-any 权限的用户管理所有转发共用的来源。 */
export interface ExternalTweetActionsProps {
	tweet: ExternalTweet;
	onDelete?: () => void;
}

export function ExternalTweetActions({ tweet, onDelete }: ExternalTweetActionsProps) {
	const [confirm, setConfirm] = useState(false);
	const refresh = useManageExternalTweet(tweet.id, "refresh");
	const withdraw = useManageExternalTweet(tweet.id, "withdraw");
	return (
		<>
			<TweetMoreMenu
				onDelete={onDelete}
				disabled={refresh.isPending || withdraw.isPending}
				dangerSlot={
					tweet.snapshot ? (
						<DropdownMenuItem
							variant="destructive"
							disabled={refresh.isPending || withdraw.isPending}
							onSelect={() => setConfirm(true)}
							className="min-h-11"
						>
							<ShieldOff className="size-4" />
							下架共享原文
						</DropdownMenuItem>
					) : undefined
				}
			>
				<DropdownMenuItem
					disabled={refresh.isPending || withdraw.isPending}
					onSelect={() =>
						refresh.mutate(undefined, {
							onSuccess: () => toast.success("原文已刷新"),
							onError: (error) => toast.error(error.message),
						})
					}
					className="min-h-11"
				>
					<RefreshCw className="size-4" />
					刷新原文
				</DropdownMenuItem>
			</TweetMoreMenu>
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
		</>
	);
}
