import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useCreatePAT, useDeletePAT, usePATs } from "@features/admin-mcp/api/queries";
import {
    type CreatePATRequest,
    PAT_EXPIRIES,
    PAT_SCOPES,
    type PATDTO,
    type PATExpiry,
    type PATScope,
} from "@features/admin-mcp/model/types";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { copyText } from "@shared/lib/clipboard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

/** MCP 接入页：管理 PAT + 复制 MCP 客户端配置 */
function AdminMCPPage() {
    const { data: tokens = [], isLoading } = usePATs();
    const [createOpen, setCreateOpen] = React.useState(false);
    const [revealToken, setRevealToken] = React.useState<string | null>(null);

    return (
        <PageShell title="MCP 接入" description="为 AI agent 签发访问令牌并复制 MCP 客户端配置">
            <PermissionGuard permission="mcp:manage-tokens">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                            AI agent（Claude Desktop / Cursor 等）用 PAT 经 MCP 读写博客文章。 明文
                            token 仅创建时显示一次，请立即复制。
                        </p>
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-1 size-4" />
                            创建令牌
                        </Button>
                    </div>

                    <PATTable
                        tokens={tokens}
                        isLoading={isLoading}
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

/** PATTable - 令牌列表 + 吊销 */
function PATTable({
    tokens,
    isLoading,
    onReveal,
}: {
    tokens: PATDTO[];
    isLoading: boolean;
    onReveal: (token: string) => void;
}) {
    const del = useDeletePAT();
    if (isLoading) {
        return (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> 加载中…
            </div>
        );
    }
    if (tokens.length === 0) {
        return (
            <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
                还没有令牌。点击「创建令牌」为 AI agent 签发第一个 PAT。
            </div>
        );
    }
    return (
        <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">名称</th>
                        <th className="px-3 py-2 text-left font-medium">权限</th>
                        <th className="px-3 py-2 text-left font-medium">创建时间</th>
                        <th className="px-3 py-2 text-left font-medium">过期</th>
                        <th className="px-3 py-2 text-left font-medium">最后使用</th>
                        <th className="px-3 py-2 text-right font-medium">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {tokens.map((t) => (
                        <tr key={t.id} className="border-t">
                            <td className="px-3 py-2 font-medium">{t.name}</td>
                            <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                    {t.scopes.map((s) => (
                                        <Badge
                                            key={s}
                                            variant="secondary"
                                            className="font-mono text-xs"
                                        >
                                            {s}
                                        </Badge>
                                    ))}
                                </div>
                            </td>
                            <td className="text-muted-foreground px-3 py-2">
                                {fmtDate(t.created_at)}
                            </td>
                            <td className="text-muted-foreground px-3 py-2">
                                {t.expires_at ? fmtDate(t.expires_at) : "永不过期"}
                            </td>
                            <td className="text-muted-foreground px-3 py-2">
                                {t.last_used_at ? fmtDate(t.last_used_at) : "从未使用"}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {t.token && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onReveal(t.token ?? "")}
                                        className="mr-1"
                                    >
                                        配置
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => del.mutate(t.id)}
                                    disabled={del.isPending}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** CreatePATDialog - 创建令牌对话框（名称 + scope 多选 + 过期三选一） */
function CreatePATDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (token: string) => void;
}) {
    const create = useCreatePAT();
    const [name, setName] = React.useState("");
    const [scopes, setScopes] = React.useState<Set<PATScope>>(new Set(["posts:read"]));
    const [expiry, setExpiry] = React.useState<PATExpiry>("90d");

    React.useEffect(() => {
        if (open) {
            setName("");
            setScopes(new Set(["posts:read"]));
            setExpiry("90d");
        }
    }, [open]);

    const toggleScope = (s: PATScope) => {
        setScopes((prev) => {
            const next = new Set(prev);
            if (next.has(s)) {
                next.delete(s);
            } else {
                next.add(s);
            }
            return next;
        });
    };

    const submit = () => {
        if (!name.trim()) {
            toast.error("请填写令牌名称");
            return;
        }
        if (scopes.size === 0) {
            toast.error("至少选择一个权限");
            return;
        }
        const body: CreatePATRequest = {
            name: name.trim(),
            scopes: [...scopes],
            expiry,
        };
        create.mutate(body, {
            onSuccess: (dto) => {
                if (dto.token) {
                    onCreated(dto.token);
                }
            },
        });
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="创建访问令牌"
            description="为 AI agent 签发 PAT。明文 token 仅显示一次。"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={create.isPending}
                    >
                        取消
                    </Button>
                    <Button onClick={submit} disabled={create.isPending}>
                        {create.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
                        创建
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pat-name">
                        名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="pat-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="如：Claude Desktop"
                        disabled={create.isPending}
                    />
                </div>
                <div className="space-y-2">
                    <Label>
                        权限范围 <span className="text-destructive">*</span>
                    </Label>
                    <div className="space-y-2">
                        {PAT_SCOPES.map((s) => (
                            <div key={s} className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    id={`pat-scope-${s}`}
                                    checked={scopes.has(s)}
                                    onCheckedChange={() => toggleScope(s)}
                                    disabled={create.isPending}
                                />
                                <Label
                                    htmlFor={`pat-scope-${s}`}
                                    className="cursor-pointer font-mono text-sm"
                                >
                                    {s}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>有效期</Label>
                    <div className="flex gap-2">
                        {PAT_EXPIRIES.map((e) => (
                            <Button
                                key={e}
                                type="button"
                                variant={expiry === e ? "default" : "outline"}
                                size="sm"
                                onClick={() => setExpiry(e)}
                                disabled={create.isPending}
                            >
                                {expiryLabel(e)}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

/** MCP server 选项（对齐后端 ADR-0007 拆分） */
type MCPServerChoice = "post" | "scraper" | "both";

const MCP_SERVER_CHOICES: { value: MCPServerChoice; label: string; desc: string }[] = [
    { value: "post", label: "仅文章", desc: "5 个文章 CRUD tool（posts:read/write/publish）" },
    {
        value: "scraper",
        label: "仅抓取",
        desc: "scrape_url + 7 个订阅 tool（posts:scrape + subscriptions:*）",
    },
    { value: "both", label: "两者", desc: "文章 + 抓取（两个 server 都配）" },
];

/** MCPConfigCard - 展示 + 复制 mcpServers 配置 JSON */
function MCPConfigCard({ token }: { token: string | null }) {
    const [copied, setCopied] = React.useState(false);
    const [serverChoice, setServerChoice] = React.useState<MCPServerChoice>("both");
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const config = React.useMemo(() => {
        if (!token) {
            return null;
        }
        const auth = { Authorization: `Bearer ${token}` };
        const mcpServers: Record<string, { url: string; headers: typeof auth }> = {};
        if (serverChoice === "post" || serverChoice === "both") {
            mcpServers["mimo-blog"] = { url: `${baseUrl}/api/v1/mcp`, headers: auth };
        }
        if (serverChoice === "scraper" || serverChoice === "both") {
            mcpServers["mimo-blog-scraper"] = {
                url: `${baseUrl}/api/v1/mcp/scraper`,
                headers: auth,
            };
        }
        return { mcpServers };
    }, [token, baseUrl, serverChoice]);

    const json = config ? JSON.stringify(config, null, 2) : "";
    const onCopy = async () => {
        if (!json) {
            return;
        }
        const ok = await copyText(json);
        if (ok) {
            setCopied(true);
            toast.success("配置已复制");
            setTimeout(() => setCopied(false), 2000);
        } else {
            toast.error("复制失败");
        }
    };

    return (
        <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <KeyRound className="text-muted-foreground size-4" />
                    <h3 className="font-medium">MCP 客户端配置</h3>
                </div>
                <Button size="sm" variant="outline" onClick={onCopy} disabled={!json}>
                    {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                    复制
                </Button>
            </div>
            {/* server 选择（ADR-0007：文章 + 抓取两个独立 server） */}
            <div className="flex flex-wrap gap-2">
                {MCP_SERVER_CHOICES.map((c) => (
                    <Button
                        key={c.value}
                        size="sm"
                        variant={serverChoice === c.value ? "default" : "outline"}
                        onClick={() => setServerChoice(c.value)}
                        title={c.desc}
                    >
                        {c.label}
                    </Button>
                ))}
            </div>
            {json ? (
                <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                    {json}
                </pre>
            ) : (
                <p className="text-muted-foreground text-sm">
                    创建令牌后或选中列表中的令牌，此处展示可复制的 mcpServers 配置 JSON。
                </p>
            )}
        </div>
    );
}

function fmtDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function expiryLabel(e: PATExpiry): string {
    switch (e) {
        case "90d":
            return "90 天";
        case "365d":
            return "1 年";
        case "never":
            return "永不过期";
    }
}

export const Route = createFileRoute("/admin/mcp")({
    component: AdminMCPPage,
});
