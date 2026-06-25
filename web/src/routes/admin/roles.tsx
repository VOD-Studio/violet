import {
	useCreatePermission,
	useCreateRole,
	useDeletePermission,
	useDeleteRole,
	useUpdateRolePermissions,
} from "@features/admin-roles/api/mutations";
import { usePermissions, useRoles } from "@features/admin-roles/api/queries";
import type { Permission, Role } from "@features/admin-roles/model/types";
import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { DataTable } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Button } from "@shared/ui/button";
import { Checkbox } from "@shared/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Separator } from "@shared/ui/separator";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

/**
 * /admin/roles - 角色权限管理
 */
export const Route = createFileRoute("/admin/roles")({
	component: RolesPage,
});

function RolesPage() {
	const { data: roles, isLoading: rolesLoading, refetch: refetchRoles } = useRoles();
	const { data: permissions, refetch: refetchPermissions } = usePermissions();

	const [roleDialogOpen, setRoleDialogOpen] = useState(false);
	const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);

	const roleColumns = [
		{ key: "name", header: "角色名", cell: (row: Role) => row.name },
		{ key: "description", header: "描述", cell: (row: Role) => row.description || "—" },
		{
			key: "permissions",
			header: "权限",
			cell: (row: Role) => row.permission_codes.join(", ") || "—",
		},
		{
			key: "users",
			header: "用户数",
			cell: (row: Role) => row.user_count ?? "—",
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
				keyExtractor={(row) => row.id.toString()}
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

function CreateRoleForm({ onCreated }: { onCreated: () => void }) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const createRole = useCreateRole();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createRole.mutate(
			{ name, description },
			{
				onSuccess: () => {
					toast.success("角色创建成功");
					onCreated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>新建角色</DialogTitle>
				<DialogDescription>输入角色名称与描述。</DialogDescription>
			</DialogHeader>
			<div className="space-y-3 py-4">
				<div className="space-y-1">
					<Label>名称</Label>
					<Input value={name} onChange={(e) => setName(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>描述</Label>
					<Input value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createRole.isPending}>
					创建
				</Button>
			</DialogFooter>
		</form>
	);
}

function CreatePermissionForm({ onCreated }: { onCreated: () => void }) {
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const createPermission = useCreatePermission();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createPermission.mutate(
			{ code, name, description },
			{
				onSuccess: () => {
					toast.success("权限创建成功");
					onCreated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>新建权限</DialogTitle>
				<DialogDescription>输入权限 code、名称与描述。</DialogDescription>
			</DialogHeader>
			<div className="space-y-3 py-4">
				<div className="space-y-1">
					<Label>Code</Label>
					<Input value={code} onChange={(e) => setCode(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>名称</Label>
					<Input value={name} onChange={(e) => setName(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>描述</Label>
					<Input value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createPermission.isPending}>
					创建
				</Button>
			</DialogFooter>
		</form>
	);
}

function DeleteRoleButton({ role, onDeleted }: { role: Role; onDeleted: () => void }) {
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

function PermissionCard({
	permission,
	onDeleted,
}: {
	permission: Permission;
	onDeleted: () => void;
}) {
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

function EditRolePermissionsDialog({
	role,
	permissions,
	onClose,
	onSaved,
}: {
	role: Role;
	permissions: Permission[];
	onClose: () => void;
	onSaved: () => void;
}) {
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
