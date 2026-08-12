import { useDeletePAT } from "@features/admin-mcp/api/queries";
import type { PATDTO, PATScope } from "@features/admin-mcp/model/types";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { format } from "date-fns";
import { Cable, Trash2 } from "lucide-react";

interface PATTableProps {
	tokens: PATDTO[];
	loading: boolean;
	/** 跳转接入区，按该令牌 scope 推导可见 server */
	onConnect: (scopes: PATScope[]) => void;
}

export function PATTable({ tokens, loading, onConnect }: PATTableProps) {
	const del = useDeletePAT();

	const columns: DataTableColumn<PATDTO>[] = [
		{
			key: "name",
			header: "名称",
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "scopes",
			header: "权限",
			cell: (row) => (
				<div className="flex flex-wrap gap-1">
					{row.scopes.map((s) => (
						<Badge key={s} variant="secondary" className="font-mono text-xs">
							{s}
						</Badge>
					))}
				</div>
			),
		},
		{
			key: "created_at",
			header: "创建时间",
			width: "160px",
			cell: (row) => format(new Date(row.created_at), "yyyy-MM-dd HH:mm"),
		},
		{
			key: "expires_at",
			header: "过期",
			width: "120px",
			cell: (row) =>
				row.expires_at ? format(new Date(row.expires_at), "yyyy-MM-dd") : "永不过期",
		},
		{
			key: "last_used_at",
			header: "最后使用",
			width: "120px",
			cell: (row) =>
				row.last_used_at ? format(new Date(row.last_used_at), "yyyy-MM-dd") : "从未使用",
		},
		{
			key: "_actions",
			header: "操作",
			hideable: false,
			sticky: "right",
			width: "96px",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon-sm"
						title="接入配置"
						onClick={() => onConnect(row.scopes)}
					>
						<Cable className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						title="吊销"
						className="hover:bg-destructive/10 hover:text-destructive"
						onClick={() => del.mutate(row.id)}
						disabled={del.isPending}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			),
		},
	];

	return (
		<DataTable<PATDTO>
			columns={columns}
			data={tokens}
			keyExtractor={(row) => row.id}
			loading={loading}
			storageKey="admin-mcp-pat-columns"
			emptyTitle="还没有令牌"
			emptyDescription="创建一个令牌来接入 MCP"
		/>
	);
}
