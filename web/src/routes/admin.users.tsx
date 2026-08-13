import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useAdminRoles } from "@features/admin-roles/api/queries";
import { getRoleBadgeVariant, getRoleDisplayName } from "@features/admin-roles/lib/utils";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table";
import { DataTable, exportToCsv } from "@features/admin-shared/ui/data-table";
import {
	useAdminUsers,
	useBatchUpdateRole,
	useBatchUpdateStatus,
	useDeleteUser,
} from "@features/admin-users/api/queries";
import type { AdminUserDTO } from "@features/admin-users/model/types";
import { CreateUserDialog } from "@features/admin-users/ui/CreateUserDialog";
import { EditUserDialog } from "@features/admin-users/ui/EditUserDialog";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Pencil, Plus, RefreshCw, Trash2, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMe } from "@/features/auth/api/queries";
import { AvatarGroup } from "@/shared/ui/avatar-group/AvatarGroup";
import { Button } from "@/shared/ui/base/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/base/select";
import { SearchInput } from "@/shared/ui/search-input";

export const Route = createFileRoute("/admin/users")({
	component: AdminUsers,
});

function AdminUsers() {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [sort, setSort] = useState<DataTableSort | null>(null);
	const [keyword, setKeyword] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

	// TODO: 用户列表当前为客户端排序，分页场景下排序结果不准确。
	// 需后端 /admin/users 支持 sort_by + order 查询参数后改为服务端排序。

	// 对话框状态
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<AdminUserDTO | null>(null);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

	// 权限检查
	const canUpdateUser = useHasPermission("user:list"); // 编辑用户权限

	// 当前登录用户（用于「是不是自己」的判断，禁止删/改自己）
	const { data: me } = useMe();
	const currentUserId = me?.id;
	// 当前登录用户是否为 root
	const isOperatorRoot = me?.is_root === true;

	// 查询角色列表
	const { data: roles = [] } = useAdminRoles();

	// 防抖搜索关键词（由 SearchInput 内部防抖，onSearch 回写）
	// 查询用户列表
	const {
		data: response,
		isLoading,
		error,
		refetch,
	} = useAdminUsers({
		page,
		limit: pageSize,
		keyword: keyword || undefined,
		role: roleFilter === "all" ? undefined : roleFilter,
		is_active: statusFilter === "all" ? undefined : statusFilter === "active",
	});

	// Mutations
	const batchUpdateStatus = useBatchUpdateStatus();
	const batchUpdateRole = useBatchUpdateRole();
	const deleteUser = useDeleteUser();

	// 批量选中是否含受保护用户（root 或自己）——含则禁用批量改/禁用
	// 注：被委派超管可被 root 批量处置，故此处只保护 root。
	const selectedHasProtected = useMemo(() => {
		if (!response?.data || selectedIds.size === 0) return false;
		return response.data.some(
			(u) => selectedIds.has(u.id) && (u.is_root || u.id === currentUserId),
		);
	}, [response?.data, selectedIds, currentUserId]);

	// 客户端排序（如果后端不支持排序）
	const sortedData = useMemo(() => {
		if (!response?.data || !sort) return response?.data || [];
		const copy = [...response.data];
		copy.sort((a, b) => {
			const av = a[sort.key as keyof AdminUserDTO];
			const bv = b[sort.key as keyof AdminUserDTO];
			const cmp = String(av).localeCompare(String(bv), "zh");
			return sort.order === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [response?.data, sort]);

	const handleDelete = (user: AdminUserDTO) => {
		setDeletingUserId(user.id);
		setDeleteConfirmOpen(true);
	};

	const handleConfirmDelete = () => {
		if (!deletingUserId) return;
		deleteUser.mutate(deletingUserId, {
			onSuccess: () => {
				setDeleteConfirmOpen(false);
				setDeletingUserId(null);
			},
		});
	};

	const handleBatchDisable = () => {
		if (selectedIds.size === 0) return;
		batchUpdateStatus.mutate(
			{
				ids: Array.from(selectedIds),
				is_active: false,
			},
			{
				onSuccess: () => {
					setSelectedIds(new Set());
				},
			},
		);
	};

	const handleBatchEnable = () => {
		if (selectedIds.size === 0) return;
		batchUpdateStatus.mutate(
			{
				ids: Array.from(selectedIds),
				is_active: true,
			},
			{
				onSuccess: () => {
					setSelectedIds(new Set());
				},
			},
		);
	};

	const handleBatchChangeRole = (role: string) => {
		if (selectedIds.size === 0) return;
		batchUpdateRole.mutate(
			{
				ids: Array.from(selectedIds),
				role,
			},
			{
				onSuccess: () => {
					setSelectedIds(new Set());
				},
			},
		);
	};

	const columns: DataTableColumn<AdminUserDTO>[] = [
		{
			key: "avatar",
			header: "头像",
			width: "72px",
			align: "center",
			cell: (row) => (
				<AvatarGroup
					users={[
						{
							username: row.username,
							avatar_url: row.avatar_url,
						},
					]}
					size="md"
				/>
			),
		},
		{
			key: "username",
			header: "用户名",
			hideable: false,
			accessorKey: "username",
			sortable: true,
			ellipsis: true,
		},
		{
			key: "email",
			header: "邮箱",
			accessorKey: "email",
			sortable: true,
			ellipsis: true,
			tooltip: (row) => `邮箱: ${row.email}`,
		},
		{
			key: "role",
			header: "角色",
			sortable: true,
			cell: (row) => {
				const variant = getRoleBadgeVariant(row.role, row.is_root);
				const label = getRoleDisplayName(roles, row.role, row.role, row.is_root);
				return <Badge variant={variant}>{label}</Badge>;
			},
		},
		{
			key: "is_active",
			header: "状态",
			cell: (row) => (
				<Badge variant={row.is_active ? "outline" : "destructive"}>
					{row.is_active ? "正常" : "已禁用"}
				</Badge>
			),
		},
		{
			key: "email_verified",
			header: "邮箱验证",
			cell: (row) => (
				<Badge variant={row.email_verified ? "outline" : "secondary"}>
					{row.email_verified ? "已验证" : "未验证"}
				</Badge>
			),
		},
		{
			key: "created_at",
			header: "创建时间",
			accessorKey: "created_at",
			sortable: true,
			cell: (row) => new Date(row.created_at).toLocaleString("zh-CN"),
		},
		{
			key: "actions",
			header: "操作",
			hideable: false,
			sticky: "right",
			width: "96px",
			align: "center",
			cell: (row) => {
				// 安全防护：root 不可被任何人操作；被委派超管仅 root 可操作；自己不可被操作
				const isProtected =
					row.is_root ||
					(!isOperatorRoot && row.role === "superadmin") ||
					row.id === currentUserId;
				return (
					<div className="flex justify-center gap-1">
						<PermissionGuard permission="user:list">
							<Button
								variant="ghost"
								size="icon-sm"
								title={isProtected ? "不可编辑此用户" : "编辑"}
								disabled={isProtected}
								onClick={(e) => {
									e.stopPropagation();
									setEditingUser(row);
									setEditDialogOpen(true);
								}}
							>
								<Pencil className="size-3.5" />
							</Button>
						</PermissionGuard>
						<PermissionGuard permission="user:ban">
							<Button
								variant="ghost"
								size="icon-sm"
								title={isProtected ? "不可删除此用户" : "删除"}
								className="hover:bg-destructive/10 hover:text-destructive"
								disabled={isProtected}
								onClick={(e) => {
									e.stopPropagation();
									handleDelete(row);
								}}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</PermissionGuard>
					</div>
				);
			},
		},
	];

	return (
		<>
			<PageShell
				title="用户管理"
				description="管理系统用户、角色和权限"
				action={
					<PermissionGuard permission="user:list">
						<Button size="sm" onClick={() => setCreateDialogOpen(true)}>
							<Plus className="size-3.5" />
							创建用户
						</Button>
					</PermissionGuard>
				}
			>
				<DataTable
					columns={columns}
					data={sortedData}
					keyExtractor={(row) => row.id}
					pagination={{
						page,
						pageSize,
						total: response?.pagination?.total || 0,
						onChange: (page, pageSize) => {
							setPage(page);
							setPageSize(pageSize);
						},
					}}
					sort={sort}
					onSortChange={setSort}
					selectable
					selectedIds={selectedIds}
					onSelectionChange={setSelectedIds}
					bulkActions={
						<>
							<PermissionGuard permission="user:ban">
								<Button
									variant="outline"
									className="h-9"
									onClick={handleBatchEnable}
									disabled={
										selectedIds.size === 0 ||
										batchUpdateStatus.isPending ||
										selectedHasProtected
									}
								>
									启用
								</Button>
							</PermissionGuard>
							<PermissionGuard permission="user:ban">
								<Button
									variant="destructive"
									className="h-9"
									onClick={handleBatchDisable}
									disabled={
										selectedIds.size === 0 ||
										batchUpdateStatus.isPending ||
										selectedHasProtected
									}
								>
									<Trash2 className="size-3.5" />
									批量禁用
								</Button>
							</PermissionGuard>
							<PermissionGuard permission="user:update-role">
								<Select
									value="batch-role"
									onValueChange={(role) => handleBatchChangeRole(role)}
									disabled={
										selectedIds.size === 0 ||
										batchUpdateRole.isPending ||
										selectedHasProtected
									}
								>
									<SelectTrigger className="h-9 w-40">
										<UserCog className="size-3.5 mr-1" />
										批量修改角色
									</SelectTrigger>
									<SelectContent>
										{roles.map((role) => (
											<SelectItem key={role.name} value={role.name || ""}>
												设为{role.description || role.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</PermissionGuard>
						</>
					}
					loading={isLoading}
					error={error ? new Error(error.message) : null}
					onRetry={() => refetch()}
					storageKey="admin-users-columns"
					filtered={keyword.length > 0 || roleFilter !== "all" || statusFilter !== "all"}
					density={density}
					resizable
					expandable
					renderExpandedRow={(row) => (
						<div className="text-muted-foreground space-y-1 text-sm">
							<p>ID：{row.id}</p>
							<p>显示名：{row.display_name || row.username}</p>
							<p>邮箱：{row.email}</p>
							<p>角色：{row.role}</p>
							<p>状态：{row.is_active ? "正常" : "已禁用"}</p>
							<p>邮箱验证：{row.email_verified ? "已验证" : "未验证"}</p>
							<p>个人简介：{row.bio || "无"}</p>
							<p>创建时间：{new Date(row.created_at).toLocaleString("zh-CN")}</p>
						</div>
					)}
					onRowClick={(row) => {
						// 受保护用户（root/被委派超管且操作者非 root/自己）不可通过行点击编辑
						const isProtected =
							row.is_root ||
							(!isOperatorRoot && row.role === "superadmin") ||
							row.id === currentUserId;
						if (isProtected) {
							toast.error("不可编辑此用户");
							return;
						}
						if (canUpdateUser) {
							setEditingUser(row);
							setEditDialogOpen(true);
						} else {
							toast.error("您没有编辑用户的权限");
						}
					}}
					caption="用户列表"
					emptyTitle="暂无用户"
					emptyDescription="还没有任何用户，点击上方按钮创建第一个用户"
					toolbar={
						<>
							<div className="min-w-50 max-w-80 flex-1">
								<SearchInput
									defaultValue=""
									placeholder="搜索用户名 / 邮箱..."
									onSearch={(v) => {
										setKeyword(v);
										setPage(1);
									}}
								/>
							</div>
							<Select value={roleFilter} onValueChange={setRoleFilter}>
								<SelectTrigger className="h-9 w-30" aria-label="角色筛选">
									<SelectValue placeholder="选择角色" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部角色</SelectItem>
									{roles.map((role) => (
										<SelectItem key={role.name} value={role.name || ""}>
											{role.description || role.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger className="h-9 w-30" aria-label="状态筛选">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部状态</SelectItem>
									<SelectItem value="active">正常</SelectItem>
									<SelectItem value="inactive">已禁用</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={density}
								onValueChange={(v) => setDensity(v as "comfortable" | "compact")}
							>
								<SelectTrigger className="h-9 w-30" aria-label="行密度">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="comfortable">标准密度</SelectItem>
									<SelectItem value="compact">紧凑密度</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetch()}
								disabled={isLoading}
							>
								<RefreshCw className="size-3.5" />
								刷新
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									exportToCsv("用户列表", columns, sortedData);
									toast.success("已导出当前页 CSV");
								}}
							>
								<Download className="size-3.5" />
								导出 CSV
							</Button>
						</>
					}
				/>
			</PageShell>

			{/* 创建用户对话框 */}
			<CreateUserDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				isOperatorRoot={isOperatorRoot}
			/>

			{/* 编辑用户对话框 */}
			{editingUser && (
				<EditUserDialog
					open={editDialogOpen}
					onOpenChange={setEditDialogOpen}
					user={editingUser}
					currentUserId={currentUserId}
					isOperatorRoot={isOperatorRoot}
				/>
			)}

			{/* 删除确认对话框 */}
			<ConfirmDialog
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
				title="确认删除用户"
				description="此操作不可撤销，确定要删除这个用户吗？"
				confirmLabel="删除"
				onConfirm={handleConfirmDelete}
				loading={deleteUser.isPending}
			/>
		</>
	);
}
