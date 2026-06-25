import { useUpdateRolePermissions } from "@features/admin-roles/api/mutations";
import type { Permission, Role } from "@features/admin-roles/model/types";
import { Button } from "@shared/ui/button";
import { Checkbox } from "@shared/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

interface EditRolePermissionsDialogProps {
	role: Role;
	permissions: Permission[];
	onClose: () => void;
	onSaved: () => void;
}

/**
 * EditRolePermissionsDialog - 编辑角色权限弹窗
 */
export function EditRolePermissionsDialog({
	role,
	permissions,
	onClose,
	onSaved,
}: EditRolePermissionsDialogProps) {
	const [selectedCodes, setSelectedCodes] = useState<string[]>(role.permission_codes);
	const updatePermissions = useUpdateRolePermissions(role.id);

	const toggleCode = (code: string) => {
		setSelectedCodes((prev) =>
			prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
		);
	};

	const handleSave = () => {
		updatePermissions.mutate(
			{ permission_codes: selectedCodes },
			{
				onSuccess: () => {
					toast.success("角色权限已更新");
					onSaved();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-h-[80vh] overflow-auto">
				<DialogHeader>
					<DialogTitle>编辑角色权限：{role.name}</DialogTitle>
					<DialogDescription>勾选该角色拥有的权限。</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2 py-4">
					{permissions.map((p) => (
						<div
							key={p.id}
							className="flex items-center gap-2 rounded-md border border-edge-hairline p-2"
						>
							<Checkbox
								checked={selectedCodes.includes(p.code)}
								onCheckedChange={() => toggleCode(p.code)}
							/>
							<div className="min-w-0">
								<p className="font-mono text-sm font-medium">{p.code}</p>
								<p className="truncate text-xs text-muted-foreground">{p.name}</p>
							</div>
						</div>
					))}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						取消
					</Button>
					<Button onClick={handleSave} disabled={updatePermissions.isPending}>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
