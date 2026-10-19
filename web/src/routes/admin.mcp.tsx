import { PageShell } from "@features/admin-layout/ui/PageShell";
import { usePATs } from "@features/admin-mcp/api/queries";
import type { PATDTO, PATScope } from "@features/admin-mcp/model/types";
import { ClientConnectPanel } from "@features/admin-mcp/ui/ClientConnectPanel";
import { PATDialog } from "@features/admin-mcp/ui/PATDialog";
import { PATTable } from "@features/admin-mcp/ui/PATTable";
import { usePagedQuery } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { Plus } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/admin/mcp")({
	component: AdminMCPPage,
});

function AdminMCPPage() {
	const { data: paged, isLoading, pagination } = usePagedQuery(usePATs);
	const tokens = paged?.data ?? [];
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [editingToken, setEditingToken] = React.useState<PATDTO | null>(null);
	// 创建成功后的一次性明文令牌；其余时刻恒为 null（配置走占位符）
	const [revealToken, setRevealToken] = React.useState<string | null>(null);
	// 接入区的 scope 上下文；null 表示展示全部 server
	const [activeScopes, setActiveScopes] = React.useState<readonly PATScope[] | null>(null);
	const [activeTokenId, setActiveTokenId] = React.useState<string | null>(null);
	const connectRef = React.useRef<HTMLDivElement>(null);
	const scrollToConnect = () =>
		connectRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

	return (
		<PageShell
			title="MCP 接入"
			description="为 AI agent 签发令牌并复制客户端配置"
			action={
				<Button
					size="sm"
					onClick={() => {
						setEditingToken(null);
						setDialogOpen(true);
					}}
				>
					<Plus className="size-3.5" />
					创建令牌
				</Button>
			}
		>
			<PermissionGuard permission="mcp:manage-tokens">
				<div className="space-y-6">
					<PATTable
						tokens={tokens}
						pagination={pagination}
						loading={isLoading}
						onConnect={(token) => {
							setRevealToken(null);
							setActiveTokenId(token.id);
							setActiveScopes(token.scopes);
							scrollToConnect();
						}}
						onEdit={(token) => {
							setRevealToken(null);
							setEditingToken(token);
							setDialogOpen(true);
						}}
					/>
					<div ref={connectRef} className="scroll-mt-6">
						<ClientConnectPanel token={revealToken} scopes={activeScopes} />
					</div>
				</div>
			</PermissionGuard>

			<PATDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				token={editingToken}
				onCreated={(token) => {
					setDialogOpen(false);
					setRevealToken(token.token ?? null);
					setActiveTokenId(token.id);
					setActiveScopes(token.scopes);
					scrollToConnect();
				}}
				onUpdated={(token) => {
					setDialogOpen(false);
					setRevealToken(null);
					if (activeTokenId === token.id) setActiveScopes(token.scopes);
				}}
			/>
		</PageShell>
	);
}
