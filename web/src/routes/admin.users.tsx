import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable } from "@features/admin-shared/ui/DataTable";
import type { DataTableColumn, DataTableSort } from "@features/admin-shared/ui/data-table-types";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/admin/users")({
	component: AdminUsers,
});

type User = {
	id: string;
	nickname: string;
	email: string;
	role: string;
};

const MOCK_DATA: User[] = [
	{ id: "1", nickname: "Admin", email: "admin@example.com", role: "SuperAdmin" },
	{ id: "2", nickname: "User", email: "user@example.com", role: "User" },
	{ id: "3", nickname: "Alice", email: "alice@example.com", role: "User" },
];

const PAGE_SIZE = 10;

const columns: DataTableColumn<User>[] = [
	{ key: "nickname", header: "昵称", accessorKey: "nickname", sortable: true },
	{ key: "email", header: "邮箱", accessorKey: "email", sortable: true },
	{
		key: "role",
		header: "角色",
		cell: (row) => (
			<Badge variant={row.role === "SuperAdmin" ? "default" : "secondary"}>{row.role}</Badge>
		),
	},
	{
		key: "actions",
		header: "操作",
		hideable: false,
		sticky: "right",
		width: "96px",
		align: "center",
		cell: () => (
			<div className="flex justify-center gap-1">
				<Button variant="ghost" size="icon-sm" title="编辑">
					<Pencil className="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					title="删除"
					className="hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 className="size-3.5" />
				</Button>
			</div>
		),
	},
];

function AdminUsers() {
	// 示例用 mock 状态模拟服务端分页/排序；接入真实接口后由 useQuery 驱动
	const [page, setPage] = useState(1);
	const [sort, setSort] = useState<DataTableSort | null>(null);

	return (
		<PageShell title="用户管理" description="查看与管理平台用户">
			<DataTable
				columns={columns}
				data={MOCK_DATA}
				keyExtractor={(row) => row.id}
				page={page}
				pageSize={PAGE_SIZE}
				total={MOCK_DATA.length}
				onPageChange={setPage}
				sort={sort}
				onSortChange={setSort}
				storageKey="admin-users-columns"
				caption="用户列表"
			/>
		</PageShell>
	);
}
