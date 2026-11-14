import { AvatarPicker } from "@entities/media/ui/AvatarPicker";
import {
	useDeleteBot,
	useRegenerateBotToken,
	useRevealBotToken,
	useUpdateBot,
} from "@features/admin-bots/api/queries";
import { BOT_DESCRIPTION_MAX, BOT_NAME_MAX } from "@features/admin-bots/model/constants";
import type { BotDTO } from "@features/admin-bots/model/types";
import { formatDateTime } from "@shared/lib/date";
import {
	Badge,
	Button,
	DataTable,
	type DataTableColumn,
	type DataTablePagination,
	Input,
	iconProps,
	Modal,
	Switch,
} from "@violet/ui";
import { cn } from "cn";
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
					<EditableBotText
						value={row.name}
						label="改名"
						title="点击改名"
						maxLength={BOT_NAME_MAX}
						className="font-medium"
						disabled={update.isPending}
						onCommit={(name) => update.mutate({ id: row.id, body: { name } })}
					/>
				</div>
			),
		},
		{
			key: "description",
			header: "简介",
			width: "260px",
			cell: (row) => (
				<EditableBotText
					value={row.description}
					label="添加简介"
					title="点击编辑简介，会显示在会话的“在场的角色”里"
					maxLength={BOT_DESCRIPTION_MAX}
					allowEmpty
					className="text-sm"
					disabled={update.isPending}
					onCommit={(description) => update.mutate({ id: row.id, body: { description } })}
				/>
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
					<Badge tone={row.enabled ? "ok" : "off"}>
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
				<div className="v-table__row-actions items-center gap-2">
					{/* 库里无密文（早于密文列创建、密钥已换）时置灰：撞错误不如直接说明为什么看不了 */}
					<Button
						iconOnly
						variant="ghost"
						size="sm"
						disabled={!row.token_viewable || reveal.isPending}
						aria-label={`查看 ${row.name} 的 token`}
						title={
							row.token_viewable
								? "查看 token"
								: "该 Bot 的凭据未加密保存，无法查看，请重置 token"
						}
						onClick={() => reveal.mutate(row.id, { onSuccess: onTokenRevealed })}
					>
						<Eye {...iconProps(14)} />
					</Button>
					<Button
						iconOnly
						variant="ghost"
						size="sm"
						aria-label={`重置 ${row.name} 的 token`}
						title="重置 token"
						onClick={() => setPending({ kind: "rotate", bot: row })}
					>
						<KeyRound {...iconProps(14)} />
					</Button>
					<Button
						iconOnly
						variant="ghost"
						size="sm"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						aria-label={`吊销 ${row.name}`}
						title="吊销 Bot"
						onClick={() => setPending({ kind: "revoke", bot: row })}
					>
						<Trash2 {...iconProps(14)} />
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
							variant={pending?.kind === "revoke" ? "destructive" : "primary"}
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

interface EditableBotTextProps {
	/** 当前值，仅作初值与「是否真改了」的基准 */
	value: string;
	/** 展示态的占位文案；值为空时显示，同时是编辑态输入框的无障碍名称前缀 */
	label: string;
	/** 展示态悬停提示 */
	title: string;
	maxLength: number;
	/** 为 true 时允许提交空串（用于清空简介），否则空值视为放弃 */
	allowEmpty?: boolean;
	disabled: boolean;
	/** 仅在内容有变化时调用 */
	onCommit: (value: string) => void;
	className?: string;
}

/**
 * 就地编辑件：点击进入编辑，失焦提交，Esc 放弃。
 */
function EditableBotText({
	value,
	label,
	title,
	maxLength,
	allowEmpty = false,
	disabled,
	onCommit,
	className,
}: EditableBotTextProps) {
	const [editing, setEditing] = React.useState(false);
	const [draft, setDraft] = React.useState(value);
	// Esc 也走 blur 收口（避免同时触发两次提交），用 ref 标记这次 blur 不提交
	const cancelled = React.useRef(false);

	if (!editing) {
		return (
			<button
				type="button"
				disabled={disabled}
				title={title}
				className={cn(
					"min-w-0 truncate rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
					className,
				)}
				onClick={() => {
					cancelled.current = false;
					setDraft(value);
					setEditing(true);
				}}
			>
				{value || <span className="text-muted-foreground">{label}</span>}
			</button>
		);
	}

	return (
		<Input
			variant="underline"
			controlSize="sm"
			aria-label={`${label} ${value}`.trim()}
			autoFocus
			maxLength={maxLength}
			value={draft}
			className="text-sm"
			classNames={{ control: "w-full min-w-40" }}
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
				setDraft(value);
				if (!cancelled.current && (next || allowEmpty) && next !== value) onCommit(next);
				cancelled.current = false;
			}}
		/>
	);
}
