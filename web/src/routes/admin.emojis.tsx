import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DataTable } from "@/shared/ui/data-table";

export const Route = createFileRoute("/admin/emojis")({
	component: AdminEmojis,
});

type Emoji = {
	id: string;
	code: string;
	url: string;
};

const data: Emoji[] = [
	{ id: "1", code: ":smile:", url: "😀" },
	{ id: "2", code: ":cry:", url: "😢" },
	{ id: "3", code: ":rocket:", url: "🚀" },
];

const columns: ColumnDef<Emoji>[] = [
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
		accessorKey: "url",
		header: "Preview",
		cell: ({ row }) => <span className="text-2xl">{row.getValue("url")}</span>,
	},
	{
		accessorKey: "code",
		header: "Code",
	},
	{
		id: "actions",
		cell: () => {
			return (
				<Button variant="destructive" size="sm">
					Delete
				</Button>
			);
		},
	},
];

function AdminEmojis() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold tracking-tight">Emojis</h2>
				<Button>Upload Emoji</Button>
			</div>
			<DataTable columns={columns} data={data} />
		</div>
	);
}
