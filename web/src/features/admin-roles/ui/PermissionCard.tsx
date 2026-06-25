import { useDeletePermission } from "@features/admin-roles/api/mutations";
import type { Permission } from "@features/admin-roles/model/types";
import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { Button } from "@shared/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface PermissionCardProps {
	permission: Permission;
	onDeleted: () => void;
}

/**
 * PermissionCard - 权限点卡片
 */
export function PermissionCard({ permission, onDeleted }: PermissionCardProps) {
	const deletePermission = useDeletePermission();
	const [open, setOpen] = useState(false);

	const handleDelete = () => {
		deletePermission.mutate(permission.code, {
			onSuccess: () => {
				toast.success("权限已删除");
				setOpen(false);
				onDeleted();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<div className="flex items-center justify-between rounded-md border border-edge-hairline p-3">
			<div className="min-w-0">
				<p className="font-mono text-sm font-medium">{permission.code}</p>
				<p className="truncate text-xs text-muted-foreground">{permission.name}</p>
			</div>
			<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
				删除
			</Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="删除权限"
				description={`确认删除权限 "${permission.code}"？`}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
