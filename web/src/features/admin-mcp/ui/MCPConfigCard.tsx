import { MCP_SERVERS } from "@features/admin-mcp/model/types";
import { copyText } from "@shared/lib/clipboard";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Check, Copy, KeyRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface MCPConfigCardProps {
    token: string | null;
}

export function MCPConfigCard({ token }: MCPConfigCardProps) {
    const [copied, setCopied] = React.useState(false);
    const [selected, setSelected] = React.useState<Set<string>>(
        () => new Set(MCP_SERVERS.map((s) => s.key)),
    );
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const json = React.useMemo(() => {
        if (!token || selected.size === 0) {
            return null;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const mcpServers: Record<string, { url: string; headers: typeof headers }> = {};
        for (const spec of MCP_SERVERS) {
            if (selected.has(spec.key)) {
                mcpServers[spec.key] = { url: `${baseUrl}${spec.endpoint}`, headers };
            }
        }
        return JSON.stringify({ mcpServers }, null, 2);
    }, [token, baseUrl, selected]);

    const toggleServer = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

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
                    <KeyRound className="size-4 text-muted-foreground" />
                    <h3 className="font-medium">客户端配置</h3>
                </div>
                <Button size="sm" variant="outline" onClick={onCopy} disabled={!json}>
                    {copied ? <Check className="mr-1 size-4" /> : <Copy className="mr-1 size-4" />}
                    复制
                </Button>
            </div>
            <div className="space-y-2">
                {MCP_SERVERS.map((spec) => (
                    <label
                        key={spec.key}
                        htmlFor={`mcp-server-${spec.key}`}
                        className="flex cursor-pointer items-start gap-2"
                    >
                        <Checkbox
                            id={`mcp-server-${spec.key}`}
                            checked={selected.has(spec.key)}
                            onCheckedChange={() => toggleServer(spec.key)}
                            disabled={!token}
                            className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                            <div className="font-mono text-sm">
                                <span className="font-medium">{spec.label}</span>
                                <span className="text-muted-foreground"> · {spec.key}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {spec.description}（{spec.scopes.join(", ")}）
                            </p>
                        </div>
                    </label>
                ))}
            </div>
            {json ? (
                <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                    {json}
                </pre>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {token ? "至少勾选一个 server。" : "创建或选中令牌后展示配置。"}
                </p>
            )}
        </div>
    );
}
