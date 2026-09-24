import { AvatarPicker } from "@entities/media/ui/AvatarPicker";
import {
	useDeleteBot,
	useRegenerateBotToken,
	useRevealBotToken,
	useUpdateBot,
} from "@features/admin-bots/api/queries";
import { BOT_NAME_MAX } from "@features/admin-bots/model/constants";
import type { BotDTO } from "@features/admin-bots/model/types";
import {
	DataTable,
	type DataTableColumn,
	type DataTablePagination,
} from "@features/admin-shared/ui/data-table";
import { formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Switch } from "@shared/ui/base/switch";
import { Modal } from "@shared/ui/modal";
import { Eye, KeyRound, Trash2 } from "lucide-react";
import * as React from "react";

interface BotTableProps {
	bots: BotDTO[];
	pagination: DataTablePagination;
	loading: boolean;
	/** 凭据取回后回传含明文的 Bot（重置与查看两条路径同源），由页面凭据卡展示 */
	onTokenRevealed: (bot: BotDTO) => void;
}

type PendingAction = { kind: "rotate" | "revoke"; bot: BotDTO } | null;

export function BotTable({ bots, pagination, loading, onTokenRevealed }: BotTableProps) {
	const update = useUpdateBot();
	const rotate = useRegenerateBotToken();
	const reveal = useRevealBotToken();
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
					onTokenRevealed(next);
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
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					{/* avatar_id 空串 = 清除，缺省 = 不改，与后端 PATCH 语义一致 */}
					<AvatarPicker
						value={row.avatar_url ?? ""}
						alt={row.name}
						sizeClassName="size-8"
						compact
						pickerTitle={`选择「${row.name}」的头像`}
						disabled={update.isPending}
						onChange={(file) =>
							update.mutate({ id: row.id, body: { avatar_id: file?.id ?? "" } })
						}
					/>
					<EditableBotName
						name={row.name}
						disabled={update.isPending}
						onCommit={(name) => update.mutate({ id: row.id, body: { name } })}
					/>
				</div>
			),
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
			key: "show_thinking",
			header: "展示思考",
			width: "120px",
			cell: (row) => (
				<Switch
					checked={row.show_thinking}
					disabled={update.isPending}
					aria-label={`${row.show_thinking ? "关闭" : "开启"} ${row.name} 的思考展示`}
					onCheckedChange={(show_thinking) =>
						update.mutate({ id: row.id, body: { show_thinking } })
					}
				/>
			),
		},
		{
			key: "thinking_default_expanded",
			header: "默认展开",
			width: "120px",
			cell: (row) => (
				<Switch
					checked={row.thinking_default_expanded}
					disabled={update.isPending}
					aria-label={`${row.thinking_default_expanded ? "默认折叠" : "默认展开"} ${row.name} 的思考过程`}
					onCheckedChange={(thinking_default_expanded) =>
						update.mutate({ id: row.id, body: { thinking_default_expanded } })
					}
				/>
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
			width: "128px",
			cell: (row) => (
				<div className="flex items-center gap-2">
					{/* 库里无密文（早于密文列创建、密钥已换）时置灰：撞错误不如直接说明为什么看不了 */}
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={!row.token_viewable || reveal.isPending}
						aria-label={`查看 ${row.name} 的 token`}
						title={
							row.token_viewable
								? "查看 token"
								: "该 Bot 的凭据未加密保存，无法查看，请重置 token"
						}
						onClick={() => reveal.mutate(row.id, { onSuccess: onTokenRevealed })}
					>
						<Eye className="size-3.5" />
					</Button>
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

interface EditableBotNameProps {
	/** 当前显示名，仅作初值与「是否真改了」的基准 */
	name: string;
	disabled: boolean;
	/** 仅在名称有变化且非空时调用 */
	onCommit: (name: string) => void;
}

/**
 * 就地改名件：点击进入编辑，失焦提交，Esc 放弃。
 */
function EditableBotName({ name, disabled, onCommit }: EditableBotNameProps) {
	const [editing, setEditing] = React.useState(false);
	const [draft, setDraft] = React.useState(name);
	// Esc 也走 blur 收口（避免同时触发两次提交），用 ref 标记这次 blur 不提交
	const cancelled = React.useRef(false);

	if (!editing) {
		return (
			<button
				type="button"
				disabled={disabled}
				title="点击改名"
				className="min-w-0 truncate rounded-md px-1 py-0.5 text-left font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
				onClick={() => {
					cancelled.current = false;
					setDraft(name);
					setEditing(true);
				}}
			>
				{name}
			</button>
		);
	}

	return (
		<Input
			aria-label={`改名 ${name}`}
			autoFocus
			maxLength={BOT_NAME_MAX}
			value={draft}
			className="h-7 w-40 text-sm font-medium"
			onFocus={(e) => e.currentTarget.select()}
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					cancelled.current = true;
					e.currentTarget.blur();
				} else if (e.key === "Enter") {
					e.currentTarget.blur();
				}
			}}
			onBlur={() => {
				const next = draft.trim();
				setEditing(false);
				setDraft(name);
				if (!cancelled.current && next && next !== name) onCommit(next);
				cancelled.current = false;
			}}
		/>
	);
}
