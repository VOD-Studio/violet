import type { UserRole } from "@entities/user/model/types";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { StatusBadge } from "@features/admin-shared/ui/StatusBadge";
import {
	useBatchUpdateUserRole,
	useBatchUpdateUserStatus,
} from "@features/admin-users/api/mutations";
import { useAdminUsers } from "@features/admin-users/api/queries";
import type { AdminUser } from "@features/admin-users/model/types";
import { UserActionCell } from "@features/admin-users/ui/UserActionCell";
import { UserRoleCell } from "@features/admin-users/ui/UserRoleCell";
import { Button } from "@shared/ui/button";
import { Checkbox } from "@shared/ui/checkbox";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * /admin/users - 用户管理
 */
export const Route = createFileRoute("/admin/users")({
	component: UsersPage,
});

const ROLES: { value: UserRole; label: string }[] = [
	{ value: "user", label: "用户" },
	{ value: "admin", label: "管理员" },
	{ value: "superadmin", label: "超级管理员" },
];

function UsersPage() {
	const [query, setQuery] = useState({ page: 1, limit: 10 });
	const [keyword, setKeyword] = useState("");
	const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const listQuery = useMemo(
		() => ({
			...query,
			keyword: keyword || undefined,
			role: roleFilter === "all" ? undefined : roleFilter,
			is_active: statusFilter === "all" ? undefined : statusFilter === "active",
		}),
		[query, keyword, roleFilter, statusFilter],
	);

	const { data, isLoading, error, refetch } = useAdminUsers(listQuery);
	const users = data?.data ?? [];
	const pagination = data?.pagination;

	const batchUpdateRole = useBatchUpdateUserRole();
	const batchUpdateStatus = useBatchUpdateUserStatus();

	const toggleSelect = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelectedIds(next);
	};

	const toggleSelectAll = () => {
		if (selectedIds.size === users.length && users.length > 0) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(users.map((u) => u.id)));
		}
	};

	const handleBatchRole = (role: UserRole) => {
		if (selectedIds.size === 0) return;
		batchUpdateRole.mutate(
			{ ids: Array.from(selectedIds), role },
			{
				onSuccess: () => {
					toast.success("批量更新角色成功");
					setSelectedIds(new Set());
					void refetch();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleBatchStatus = (isActive: boolean) => {
		if (selectedIds.size === 0) return;
		batchUpdateStatus.mutate(
			{ ids: Array.from(selectedIds), is_active: isActive },
			{
				onSuccess: () => {
					toast.success(isActive ? "批量启用成功" : "批量禁用成功");
					setSelectedIds(new Set());
					void refetch();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const columns: DataTableColumn<AdminUser>[] = [
		{
			key: "select",
			header: (
				<Checkbox
					checked={users.length > 0 && selectedIds.size === users.length}
					data-indeterminate={selectedIds.size > 0 && selectedIds.size < users.length}
					onCheckedChange={toggleSelectAll}
					aria-label="全选"
				/>
			),
			cell: (row: AdminUser) => (
				<Checkbox
					checked={selectedIds.has(row.id)}
					onCheckedChange={() => toggleSelect(row.id)}
					aria-label={`选择 ${row.username}`}
				/>
			),
			width: "48px",
			sticky: "left",
			className: "text-center",
		},
		{ key: "username", header: "用户名", accessorKey: "username" },
		{ key: "email", header: "邮箱", accessorKey: "email" },
		{
			key: "role",
			header: "角色",
			cell: (row: AdminUser) => <UserRoleCell user={row} onMutated={refetch} />,
			width: "140px",
		},
		{
			key: "status",
			header: "状态",
			cell: (row: AdminUser) => (
				<StatusBadge status={row.is_active ? "active" : "inactive"} kind="user" />
			),
			width: "96px",
			align: "center",
		},
		{
			key: "created",
			header: "创建时间",
			accessorKey: "created_at",
			cell: (row: AdminUser) => new Date(row.created_at).toLocaleDateString("zh-CN"),
			width: "120px",
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: AdminUser) => <UserActionCell user={row} onMutated={refetch} />,
			width: "160px",
			sticky: "right",
		},
	];

	return (
		<div>
			<PageHeader title="用户管理" description="管理系统用户、角色与启用状态" />

			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
				<div className="flex-1 space-y-1">
					<Label className="text-xs">关键词</Label>
					<Input
						placeholder="用户名或邮箱"
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
					/>
				</div>
				<div className="w-full space-y-1 sm:w-40">
					<Label className="text-xs">角色</Label>
					<Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
						<SelectTrigger>
							<SelectValue placeholder="全部角色" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">全部角色</SelectItem>
							{ROLES.map((r) => (
								<SelectItem key={r.value} value={r.value}>
									{r.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="w-full space-y-1 sm:w-40">
					<Label className="text-xs">状态</Label>
					<Select
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
					>
						<SelectTrigger>
							<SelectValue placeholder="全部状态" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">全部状态</SelectItem>
							<SelectItem value="active">启用</SelectItem>
							<SelectItem value="inactive">禁用</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button onClick={() => setQuery({ ...query, page: 1 })} className="w-full sm:w-auto">
					搜索
				</Button>
			</div>

			{selectedIds.size > 0 && (
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<span className="text-sm text-muted-foreground">已选择 {selectedIds.size} 项</span>
					<Button variant="outline" size="sm" onClick={() => handleBatchStatus(true)}>
						批量启用
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleBatchStatus(false)}>
						批量禁用
					</Button>
					<Select onValueChange={(v) => handleBatchRole(v as UserRole)}>
						<SelectTrigger className="h-8 w-36">
							<SelectValue placeholder="批量改角色" />
						</SelectTrigger>
						<SelectContent>
							{ROLES.map((r) => (
								<SelectItem key={r.value} value={r.value}>
									{r.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<DataTable
				columns={columns}
				data={users}
				loading={isLoading}
				error={error}
				onRetry={refetch}
				keyExtractor={(row) => row.id}
				stickyHeader
				maxHeight="55vh"
				density="compact"
				caption="用户列表"
				emptyTitle="NO_USERS"
				emptyDescription="没有找到用户"
			/>

			{pagination?.total_pages && pagination.total_pages > 1 ? (
				<Pagination
					className="mt-4"
					page={query.page}
					totalPages={pagination.total_pages}
					onChange={(page) => setQuery({ ...query, page })}
				/>
			) : null}
		</div>
	);
}
