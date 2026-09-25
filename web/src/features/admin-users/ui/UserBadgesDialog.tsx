import { CHAT_BADGES, useGrantBadges, useRevokeBadge, useUserBadges } from "@entities/chat-badge";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/base/button";
import { Modal } from "@/shared/ui/modal";
import type { AdminUserDTO } from "../model/types";

interface UserBadgesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	user: AdminUserDTO;
}

/** 按目录管理单个用户的徽章持有;授予/撤销即时生效,展示侧自动跟随。 */
export function UserBadgesDialog({ open, onOpenChange, user }: UserBadgesDialogProps) {
	const client = useQueryClient();
	const { data: grants, isLoading } = useUserBadges(user.id, open);
	const grant = useGrantBadges(user.id);
	const revoke = useRevokeBadge(user.id);
	const ownedIDs = new Set((grants ?? []).map((item) => item.badge_id));
	const pending = grant.isPending || revoke.isPending;

	const refreshSideEffects = () => {
		// 撤销影响该用户的佩戴展示:按缓存键根失效聊天外观批量缓存
		// (键根与 features/chat 的 appearanceKeys.root 对齐,不跨 feature 引用)。
		void client.invalidateQueries({ queryKey: ["chat", "appearance"] });
	};

	const toggle = (badgeID: string) => {
		if (ownedIDs.has(badgeID)) {
			revoke.mutate(badgeID, {
				onSuccess: () => {
					toast.success(`已撤销「${labelOf(badgeID)}」`);
					refreshSideEffects();
				},
				onError: (error) => toast.error(errorMessage(error)),
			});
			return;
		}
		grant.mutate([badgeID], {
			onSuccess: () => {
				toast.success(`已授予「${labelOf(badgeID)}」`);
				refreshSideEffects();
			},
			onError: (error) => toast.error(errorMessage(error)),
		});
	};

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={`徽章管理 · ${user.display_name || user.username}`}
			description="授予后用户可在聊天外观中佩戴(至多 3 枚);撤销即从展示中消失。"
		>
			<div className="max-h-[60vh] overflow-y-auto pr-1">
				{isLoading ? (
					<div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						加载持有记录…
					</div>
				) : (
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{CHAT_BADGES.map((badge) => {
							const owned = ownedIDs.has(badge.id);
							return (
								<li key={badge.id}>
									<button
										type="button"
										aria-pressed={owned}
										disabled={pending}
										onClick={() => toggle(badge.id)}
										className={cn(
											"flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs transition",
											owned
												? "border-primary bg-accent shadow-[inset_0_0_0_1px_var(--primary)]"
												: "border-border bg-card hover:bg-secondary",
											pending && "cursor-wait opacity-60",
										)}
									>
										<img
											src={badge.image}
											alt=""
											className="h-8 w-auto max-w-full object-contain"
											loading="lazy"
											decoding="async"
											draggable={false}
										/>
										<span className="inline-flex items-center gap-1">
											<BadgeCheck
												className={cn(
													"size-3.5",
													owned
														? "text-primary"
														: "text-muted-foreground/50",
												)}
												aria-hidden="true"
											/>
											{badge.name}
										</span>
										<span className="text-muted-foreground">
											{owned ? "点击撤销" : "点击授予"}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
			<div className="mt-4 flex justify-end">
				<Button variant="outline" onClick={() => onOpenChange(false)}>
					关闭
				</Button>
			</div>
		</Modal>
	);
}

function labelOf(badgeID: string): string {
	return CHAT_BADGES.find((badge) => badge.id === badgeID)?.name ?? badgeID;
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : "操作失败,请重试";
}
