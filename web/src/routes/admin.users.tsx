import { PageShell } from "@features/admin-layout/ui/PageShell";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DataTable } from "@/shared/ui/data-table";

export const Route = createFileRoute("/admin/users")({
	component: AdminUsers,
});

type User = {
	id: string;
	nickname: string;
	email: string;
	role: string;
};

const data: User[] = [
	{ id: "1", nickname: "Admin", email: "admin@example.com", role: "SuperAdmin" },
	{ id: "2", nickname: "User", email: "user@example.com", role: "User" },
	{ id: "3", nickname: "Alice", email: "alice@example.com", role: "User" },
];

const columns: ColumnDef<User>[] = [
	{
		id: "select",
		header: ({ table }) => (
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "nickname",
		header: "Nickname",
	},
	{
		accessorKey: "email",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Email
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
	},
	{
		accessorKey: "role",
		header: "Role",
	},
];

function AdminUsers() {
	return (
		<PageShell title="用户管理" description="查看与管理平台用户">
			<DataTable columns={columns} data={data} />
		</PageShell>
	);
}
