import {
	useDeleteBot,
	useRegenerateBotToken,
	useUpdateBot,
} from "@features/admin-bots/api/queries";
import type { BotDTO } from "@features/admin-bots/model/types";
import {
	DataTable,
	type DataTableColumn,
	type DataTablePagination,
} from "@features/admin-shared/ui/data-table";
import { formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import { Modal } from "@shared/ui/modal";
import { KeyRound, Trash2 } from "lucide-react";
import * as React from "react";

interface BotTableProps {
	bots: BotDTO[];
	pagination: DataTablePagination;
	loading: boolean;
	/** 重置成功后回传含新明文的 Bot，由页面凭据卡展示 */
	onTokenRotated: (bot: BotDTO) => void;
}

type PendingAction = { kind: "rotate" | "revoke"; bot: BotDTO } | null;

export function BotTable({ bots, pagination, loading, onTokenRotated }: BotTableProps) {
	const update = useUpdateBot();
	const rotate = useRegenerateBotToken();
	const del = useDeleteBot();
	const [pending, setPending] = React.useState<PendingAction>(null);

	const confirmText = React.useMemo(() => {
		if (!pending) return { title: "", description: "", confirm: "" };
		if (pending.kind === "rotate") {
			return {
				title: "重置 token",
				description: `旧 token 立即失效，正在用它的程序会当场鉴权失败并需要换上新 token。`,
				confirm: "确认重置",
			};
		}
		return {
			title: "吊销 Bot",
			description: `删除「${pending.bot.name}」的凭据并停用它的虚拟用户。历史消息保留，但停用后它不会再出现在联系人搜索里。`,
			confirm: "确认吊销",
		};
	}, [pending]);

	const runPending = () => {
		if (!pending) return;
		const { kind, bot } = pending;
		if (kind === "rotate") {
			rotate.mutate(bot.id, {
				onSuccess: (next) => {
					setPending(null);
					onTokenRotated(next);
				},
			});
			return;
		}
		del.mutate(bot.id, { onSuccess: () => setPending(null) });
	};

	const columns: DataTableColumn<BotDTO>[] = [
		{
			key: "name",
			header: "名称",
			cell: (row) => <span className="font-medium">{row.name}</span>,
		},
		{
			key: "username",
			header: "用户名",
			width: "180px",
			cell: (row) => <code className="font-mono text-xs">@{row.username}</code>,
		},
		{
			key: "enabled",
			header: "状态",
			width: "140px",
			cell: (row) => (
				<div className="flex items-center gap-2">
					<Switch
						checked={row.enabled}
						disabled={update.isPending}
						aria-label={`${row.enabled ? "禁用" : "启用"} ${row.name}`}
						onCheckedChange={(enabled) =>
							update.mutate({ id: row.id, body: { enabled } })
						}
					/>
					<Badge variant={row.enabled ? "secondary" : "outline"}>
						{row.enabled ? "已启用" : "已禁用"}
					</Badge>
				</div>
			),
		},
		{
			key: "created_at",
			header: "创建时间",
			width: "160px",
			cell: (row) => formatDateTime(row.created_at),
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
						aria-label={`重置 ${row.name} 的 token`}
						title="重置 token"
						onClick={() => setPending({ kind: "rotate", bot: row })}
					>
						<KeyRound className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						aria-label={`吊销 ${row.name}`}
						title="吊销 Bot"
						onClick={() => setPending({ kind: "revoke", bot: row })}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			),
		},
	];

	return (
		<>
			<DataTable<BotDTO>
				columns={columns}
				data={bots}
				pagination={pagination}
				keyExtractor={(row) => row.id}
				loading={loading}
				storageKey="admin-chat-bots-columns"
				emptyTitle="还没有 Bot"
				emptyDescription="注册一个 Bot，让外部程序以虚拟用户身份参与聊天"
			/>
			<Modal
				open={pending !== null}
				onOpenChange={(open) => {
					if (!open) setPending(null);
				}}
				title={confirmText.title}
				description={confirmText.description}
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setPending(null)}>
							取消
						</Button>
						<Button
							variant={pending?.kind === "revoke" ? "destructive" : "default"}
							onClick={runPending}
							disabled={rotate.isPending || del.isPending}
						>
							{confirmText.confirm}
						</Button>
					</>
				}
			/>
		</>
	);
}
