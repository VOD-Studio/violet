import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { useDeleteUser, useUpdateUserStatus } from "@features/admin-users/api/mutations";
import type { AdminUser } from "@features/admin-users/model/types";
import { Button } from "@shared/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface UserActionCellProps {
	user: AdminUser;
	onMutated: () => void;
}

/**
 * UserActionCell - 用户操作单元格
 *
 * 提供启用/禁用与删除操作。
 */
export function UserActionCell({ user, onMutated }: UserActionCellProps) {
	const updateStatus = useUpdateUserStatus(user.id);
	const deleteUser = useDeleteUser(user.id);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleStatus = (isActive: boolean) => {
		updateStatus.mutate(
			{ is_active: isActive },
			{
				onSuccess: () => {
					toast.success(isActive ? "用户已启用" : "用户已禁用");
					onMutated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleDelete = () => {
		deleteUser.mutate(undefined, {
			onSuccess: () => {
				toast.success("用户已删除");
				setConfirmOpen(false);
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<Button
					variant={user.is_active ? "outline" : "default"}
					size="sm"
					onClick={() => handleStatus(!user.is_active)}
					disabled={updateStatus.isPending}
				>
					{user.is_active ? "禁用" : "启用"}
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onClick={() => setConfirmOpen(true)}
					disabled={deleteUser.isPending}
				>
					删除
				</Button>
			</div>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除用户"
				description={`确认删除用户 "${user.username}"？此操作不可撤销。`}
				onConfirm={handleDelete}
			/>
		</>
	);
}
