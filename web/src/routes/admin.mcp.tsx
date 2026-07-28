import { PageShell } from "@features/admin-layout/ui/PageShell";
import { usePATs } from "@features/admin-mcp/api/queries";
import type { PATScope } from "@features/admin-mcp/model/types";
import { ClientConnectPanel } from "@features/admin-mcp/ui/ClientConnectPanel";
import { CreatePATDialog } from "@features/admin-mcp/ui/CreatePATDialog";
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
    // 创建成功后的一次性明文令牌；其余时刻恒为 null（配置走占位符）
    const [revealToken, setRevealToken] = React.useState<string | null>(null);
    // 接入区的 scope 上下文；null 表示展示全部 server
    const [activeScopes, setActiveScopes] = React.useState<readonly PATScope[] | null>(null);
    const connectRef = React.useRef<HTMLDivElement>(null);
    const scrollToConnect = () =>
        connectRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
                        onConnect={(scopes) => {
                            setRevealToken(null);
                            setActiveScopes(scopes);
                            scrollToConnect();
                        }}
                    />
                    <div ref={connectRef} className="scroll-mt-6">
                        <ClientConnectPanel token={revealToken} scopes={activeScopes} />
                    </div>
                </div>
            </PermissionGuard>

            <CreatePATDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(token, scopes) => {
                    setCreateOpen(false);
                    setRevealToken(token);
                    setActiveScopes(scopes);
                    scrollToConnect();
                }}
            />
        </PageShell>
    );
}
