import { useBots } from "@features/admin-bots/api/queries";
import { BotTable } from "@features/admin-bots/ui/BotTable";
import { BotTokenCard } from "@features/admin-bots/ui/BotTokenCard";
import { CreateBotDialog } from "@features/admin-bots/ui/CreateBotDialog";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { usePagedQuery } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/admin/chat-bots")({
	component: AdminChatBotsPage,
});

function AdminChatBotsPage() {
	const { data: paged, isLoading, pagination } = usePagedQuery(useBots);
	const bots = paged?.data ?? [];
	const [createOpen, setCreateOpen] = React.useState(false);
	// 明文凭据：注册、重置与「查看 token」后暂存，收起即从内存丢弃（库里存着密文，随时能再取）
	const [reveal, setReveal] = React.useState<{ name: string; token: string } | null>(null);

	return (
		<PageShell
			title="聊天 Bot"
			description="为外部程序签发聊天凭据，bot 以虚拟用户身份收发消息"
			action={
				<Button size="sm" onClick={() => setCreateOpen(true)}>
					<Plus className="size-3.5" />
					注册 Bot
				</Button>
			}
		>
			<PermissionGuard permission="chat:bot-manage">
				<div className="space-y-6">
					{reveal ? (
						<BotTokenCard
							token={reveal.token}
							botName={reveal.name}
							onDismiss={() => setReveal(null)}
						/>
					) : null}
					<BotTable
						bots={bots}
						pagination={pagination}
						loading={isLoading}
						onTokenRevealed={(bot) =>
							setReveal({ name: bot.name, token: bot.token ?? "" })
						}
					/>
				</div>
			</PermissionGuard>

			<CreateBotDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onCreated={(bot) => {
					setCreateOpen(false);
					setReveal({ name: bot.name, token: bot.token ?? "" });
				}}
			/>
		</PageShell>
	);
}
