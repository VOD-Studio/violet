import { usePermissions, useRoles } from "@features/admin-roles/api/queries";
import type { Role } from "@features/admin-roles/model/types";
import { CreatePermissionForm } from "@features/admin-roles/ui/CreatePermissionForm";
import { CreateRoleForm } from "@features/admin-roles/ui/CreateRoleForm";
import { DeleteRoleButton } from "@features/admin-roles/ui/DeleteRoleButton";
import { EditRolePermissionsDialog } from "@features/admin-roles/ui/EditRolePermissionsDialog";
import { PermissionCard } from "@features/admin-roles/ui/PermissionCard";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@shared/ui/dialog";
import { Separator } from "@shared/ui/separator";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

/**
 * /admin/roles - 角色权限管理
 */
export const Route = createFileRoute("/admin/roles")({
	component: RolesPage,
});

function RolesPage() {
	const { data: roles, isLoading: rolesLoading, error, refetch: refetchRoles } = useRoles();
	const { data: permissions, refetch: refetchPermissions } = usePermissions();

	const [roleDialogOpen, setRoleDialogOpen] = useState(false);
	const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);

	const roleColumns: DataTableColumn<Role>[] = [
		{ key: "name", header: "角色名", accessorKey: "name", width: "140px" },
		{
			key: "description",
			header: "描述",
			accessorKey: "description",
			cell: (row: Role) => row.description || "—",
		},
		{
			key: "permissions",
			header: "权限",
			accessorKey: "permission_codes",
			cell: (row: Role) => row.permission_codes.join(", ") || "—",
		},
		{
			key: "users",
			header: "用户数",
			accessorKey: "user_count",
			cell: (row: Role) => row.user_count ?? "—",
			width: "90px",
			align: "center",
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: Role) => (
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => setEditingRole(row)}>
						权限
					</Button>
					<DeleteRoleButton role={row} onDeleted={refetchRoles} />
				</div>
			),
			width: "140px",
			sticky: "right",
		},
	];

	return (
		<div>
			<PageHeader title="角色权限" description="管理角色与系统权限点" />

			<div className="mb-4 flex gap-2">
				<Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
					<DialogTrigger asChild>
						<Button>新建角色</Button>
					</DialogTrigger>
					<DialogContent>
						<CreateRoleForm
							onCreated={() => {
								setRoleDialogOpen(false);
								void refetchRoles();
							}}
						/>
					</DialogContent>
				</Dialog>

				<Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
					<DialogTrigger asChild>
						<Button variant="outline">新建权限</Button>
					</DialogTrigger>
					<DialogContent>
						<CreatePermissionForm
							onCreated={() => {
								setPermissionDialogOpen(false);
								void refetchPermissions();
							}}
						/>
					</DialogContent>
				</Dialog>
			</div>

			<DataTable
				columns={roleColumns}
				data={roles ?? []}
				loading={rolesLoading}
				error={error}
				onRetry={refetchRoles}
				keyExtractor={(row) => row.id.toString()}
				stickyHeader
				maxHeight="55vh"
				density="compact"
				caption="角色列表"
				emptyTitle="NO_ROLES"
				emptyDescription="暂无角色"
			/>

			{permissions && permissions.length > 0 && (
				<>
					<Separator className="my-6" />
					<h3 className="mb-3 font-mono text-sm font-bold">权限点</h3>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{permissions.map((p) => (
							<PermissionCard key={p.id} permission={p} onDeleted={refetchPermissions} />
						))}
					</div>
				</>
			)}

			{editingRole && permissions && (
				<EditRolePermissionsDialog
					role={editingRole}
					permissions={permissions}
					onClose={() => setEditingRole(null)}
					onSaved={() => {
						setEditingRole(null);
						void refetchRoles();
					}}
				/>
			)}
		</div>
	);
}
