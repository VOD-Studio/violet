import { useDeleteRole } from "@features/admin-roles/api/mutations";
import type { Role } from "@features/admin-roles/model/types";
import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { Button } from "@shared/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteRoleButtonProps {
	role: Role;
	onDeleted: () => void;
}

/**
 * DeleteRoleButton - 删除角色按钮
 */
export function DeleteRoleButton({ role, onDeleted }: DeleteRoleButtonProps) {
	const deleteRole = useDeleteRole();
	const [open, setOpen] = useState(false);

	const handleDelete = () => {
		deleteRole.mutate(role.id, {
			onSuccess: () => {
				toast.success("角色已删除");
				setOpen(false);
				onDeleted();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			<Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
				删除
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="删除角色"
				description={`确认删除角色 "${role.name}"？`}
				onConfirm={handleDelete}
			/>
		</>
	);
}
