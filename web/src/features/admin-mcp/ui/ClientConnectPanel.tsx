import { type ConfigContext, MCP_CLIENTS } from "@features/admin-mcp/model/clients";
import { MCP_SERVERS, serversForScopes } from "@features/admin-mcp/model/types";
import { ClientInstallView } from "@features/admin-mcp/ui/ClientInstallView";
import { copyText } from "@shared/lib/clipboard";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Check, Copy, Globe, KeyRound, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface ClientConnectPanelProps {
    /** 一次性明文令牌；null 时配置以 <TOKEN> 占位 */
    token: string | null;
    /** 限定令牌的 scope；null 表示展示全部 server */
    scopes: readonly string[] | null;
}

/** ClientConnectPanel - 客户端接入区：令牌横幅 + server 开关 + 纵向客户端切换 + 安装方式 */
export function ClientConnectPanel({ token, scopes }: ClientConnectPanelProps) {
    const available = React.useMemo(
        () => (scopes ? serversForScopes(scopes) : MCP_SERVERS),
        [scopes],
    );
    const availKey = available.map((s) => s.key).join(",");

    // server 开关默认全开（= scope 推导结果），scopes 上下文变化时重置
    const [enabled, setEnabled] = React.useState<ReadonlySet<string>>(
        () => new Set(available.map((s) => s.key)),
    );
    const [prevAvailKey, setPrevAvailKey] = React.useState(availKey);
    if (prevAvailKey !== availKey) {
        setPrevAvailKey(availKey);
        setEnabled(new Set(available.map((s) => s.key)));
    }

    const [clientKey, setClientKey] = React.useState(MCP_CLIENTS[0].key);
    const [dismissedToken, setDismissedToken] = React.useState<string | null>(null);
    const showBanner = token !== null && token !== dismissedToken;

    const activeServers = available.filter((s) => enabled.has(s.key));
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ctx: ConfigContext = { origin, token, servers: activeServers };
    const client = MCP_CLIENTS.find((c) => c.key === clientKey) ?? MCP_CLIENTS[0];
    const primary = client.primary(ctx);
    const fallback = client.fallback?.(ctx);
    // 占位符模式下 primary 可能已退化为 fallback 同款（如 Cursor），避免重复展示
    const showFallback =
        fallback !== undefined && JSON.stringify(fallback) !== JSON.stringify(primary);

    const toggleServer = (key: string) => {
        setEnabled((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <section className="space-y-4 rounded-md border p-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <h3 className="font-medium">客户端接入</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    选择你的 AI 客户端，按其方式安装本站 MCP server。
                </p>
            </div>

            {showBanner ? (
                <TokenBanner token={token} onDismiss={() => setDismissedToken(token)} />
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">包含 server:</span>
                {available.map((s) => {
                    const on = enabled.has(s.key);
                    return (
                        <button
                            key={s.key}
                            type="button"
                            title={
                                s.anonymous
                                    ? `${s.description}（公开·无需令牌）`
                                    : `${s.description}（${s.scopes.join(", ")}）`
                            }
                            onClick={() => toggleServer(s.key)}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                on
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            {on ? <Check className="size-3" /> : null}
                            {s.label}
                            {s.anonymous ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Globe className="size-2.5" />
                                    公开
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <div className="flex gap-4">
                <TooltipProvider delayDuration={200}>
                    <nav className="flex w-11 shrink-0 flex-col gap-1 md:w-44">
                        {MCP_CLIENTS.map((c) => {
                            const Icon = c.icon;
                            const selected = c.key === client.key;
                            return (
                                <Tooltip key={c.key}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => setClientKey(c.key)}
                                            className={cn(
                                                "flex items-center justify-center gap-2 rounded-md p-2 text-sm transition-colors md:justify-start",
                                                selected
                                                    ? "bg-accent font-medium text-accent-foreground"
                                                    : "text-muted-foreground hover:bg-muted",
                                            )}
                                        >
                                            <Icon className="size-4 shrink-0" />
                                            <span className="hidden truncate md:inline">
                                                {c.label}
                                            </span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="md:hidden">
                                        {c.label}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </nav>
                </TooltipProvider>

                <div className="min-w-0 flex-1 space-y-3">
                    <h4 className="text-sm font-medium">{client.label}</h4>
                    {activeServers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">至少启用一个 server。</p>
                    ) : (
                        <>
                            <ClientInstallView view={primary} />
                            {showFallback ? (
                                <details className="group">
                                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                        备选安装方式
                                    </summary>
                                    <div className="mt-2">
                                        <ClientInstallView view={fallback} />
                                    </div>
                                </details>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

/** TokenBanner - 创建成功后的一次性明文令牌横幅 */
function TokenBanner({ token, onDismiss }: { token: string; onDismiss: () => void }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-medium">令牌已创建，仅此一次完整显示</p>
                <div className="flex items-center gap-2">
                    <code className="min-w-0 break-all rounded bg-background/80 px-2 py-1 font-mono text-xs">
                        {token}
                    </code>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={async () => {
                            const ok = await copyText(token);
                            if (ok) {
                                setCopied(true);
                                toast.success("令牌已复制");
                                setTimeout(() => setCopied(false), 2000);
                            } else {
                                toast.error("复制失败");
                            }
                        }}
                    >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        复制
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    关闭或刷新页面后将无法再次查看，请立即保存。下方安装命令已填入该令牌。
                </p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                title="我已保存，关闭提示"
                onClick={onDismiss}
            >
                <X className="size-4" />
            </Button>
        </div>
    );
}
