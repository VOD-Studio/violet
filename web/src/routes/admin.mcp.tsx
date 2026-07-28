import { PageShell } from "@features/admin-layout/ui/PageShell";
import { usePATs } from "@features/admin-mcp/api/queries";
import { CreatePATDialog } from "@features/admin-mcp/ui/CreatePATDialog";
import { MCPConfigCard } from "@features/admin-mcp/ui/MCPConfigCard";
import { PATTable } from "@features/admin-mcp/ui/PATTable";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/base/button";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/admin/mcp")({
    component: AdminMCPPage,
});

function AdminMCPPage() {
    const { data: tokens = [], isLoading } = usePATs();
    const [createOpen, setCreateOpen] = React.useState(false);
    const [revealToken, setRevealToken] = React.useState<string | null>(null);

    return (
        <PageShell
            title="MCP 接入"
            description="为 AI agent 签发令牌并复制客户端配置"
            action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    创建令牌
                </Button>
            }
        >
            <PermissionGuard permission="mcp:manage-tokens">
                <div className="space-y-6">
                    <PATTable
                        tokens={tokens}
                        loading={isLoading}
                        onReveal={(t) => setRevealToken(t)}
                    />
                    <MCPConfigCard token={revealToken ?? tokens[0]?.token ?? null} />
                </div>
            </PermissionGuard>

            <CreatePATDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(t) => {
                    setCreateOpen(false);
                    setRevealToken(t);
                }}
            />
        </PageShell>
    );
}
