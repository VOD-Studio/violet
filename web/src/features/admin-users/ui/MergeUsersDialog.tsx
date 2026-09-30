import { useAdminUsers, useMergeUsers } from "@features/admin-users/api/queries";
import type { AdminUserDTO } from "@features/admin-users/model/types";
import { Button, Input, Label, Modal } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface MergeUsersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 被合并方（secondary）：其内容归属将迁给主账号后删除 */
	user: AdminUserDTO;
}

/**
 * MergeUsersDialog - 合并账号对话框
 *
 * 从被合并方行发起：搜索选择主账号（primary），输入被合并方用户名二次确认
 * 后提交。合并不可逆，全程后端单事务 + confirm 校验兜底。
 */
export function MergeUsersDialog({ open, onOpenChange, user }: MergeUsersDialogProps) {
	const [keyword, setKeyword] = useState("");
	const [primary, setPrimary] = useState<AdminUserDTO | null>(null);
	const [confirmName, setConfirmName] = useState("");
	const [error, setError] = useState("");
	const mergeUsers = useMergeUsers();

	// 搜索候选主账号（排除被合并方与自己）
	const { data: candidates } = useAdminUsers({ keyword: keyword || undefined, limit: 10 });
	const list = (candidates?.data ?? []).filter((u) => u.id !== user.id && !u.is_deleted);

	const reset = () => {
		setKeyword("");
		setPrimary(null);
		setConfirmName("");
		setError("");
	};

	const handleClose = () => {
		reset();
		onOpenChange(false);
	};

	const canSubmit = primary !== null && confirmName === user.username && !mergeUsers.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!primary || !canSubmit) return;
		mergeUsers.mutate(
			{
				primary_id: primary.id,
				secondary_id: user.id,
				confirm_username: confirmName,
			},
			{ onSuccess: handleClose },
		);
	};

	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				if (!next) handleClose();
			}}
			title="合并账号"
			description={`将「${user.username}」的文章、评论、推文等内容迁入主账号，随后删除该账号。此操作不可逆。`}
			size="sm"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={mergeUsers.isPending}
					>
						取消
					</Button>
					<Button
						type="submit"
						form="merge-users-form"
						variant="destructive"
						disabled={!canSubmit}
					>
						{mergeUsers.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
						合并并删除「{user.username}」
					</Button>
				</>
			}
		>
			<form id="merge-users-form" onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="merge-primary-search">搜索主账号</Label>
					<Input
						id="merge-primary-search"
						value={keyword}
						onChange={(e) => {
							setKeyword(e.target.value);
							setPrimary(null);
						}}
						placeholder="输入用户名或邮箱搜索"
					/>
					{list.length > 0 && !primary ? (
						<div className="border-border divide-y rounded-lg border">
							{list.map((u) => (
								<button
									key={u.id}
									type="button"
									onClick={() => setPrimary(u)}
									className="hover:bg-muted/50 flex w-full items-center justify-between px-3 py-2 text-sm"
								>
									<span>{u.username}</span>
									<span className="text-muted-foreground text-xs">{u.email}</span>
								</button>
							))}
						</div>
					) : null}
					{primary ? (
						<p className="text-muted-foreground text-sm">
							主账号：
							<span className="text-foreground font-medium">{primary.username}</span>
						</p>
					) : null}
				</div>
				<div className="space-y-2">
					<Label htmlFor="merge-confirm">输入「{user.username}」确认合并</Label>
					<Input
						id="merge-confirm"
						value={confirmName}
						onChange={(e) => setConfirmName(e.target.value)}
						placeholder={user.username}
						aria-invalid={!!error}
					/>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</div>
			</form>
		</Modal>
	);
}

export default MergeUsersDialog;
