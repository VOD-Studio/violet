import type { InstallView } from "@features/admin-mcp/model/clients";
import { copyText } from "@shared/lib/clipboard";
import { Button } from "@shared/ui/base/button";
import { Check, Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

/** ClientInstallView - 渲染一种客户端安装方式（CLI 命令 / deeplink / 配置片段 / 图文步骤） */
export function ClientInstallView({ view }: { view: InstallView }) {
    switch (view.kind) {
        case "commands":
            return <CommandsView view={view} />;
        case "deeplinks":
            return <DeeplinksView view={view} />;
        case "snippet":
            return <SnippetView view={view} />;
        case "steps":
            return <StepsView view={view} />;
    }
}

function ViewTitle({ title, note }: { title: string; note?: string }) {
    return (
        <div className="space-y-0.5">
            <p className="text-sm font-medium">{title}</p>
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </div>
    );
}

function CopyButton({
    text,
    label,
    className,
}: {
    text: string;
    label?: string;
    className?: string;
}) {
    const [copied, setCopied] = React.useState(false);
    return (
        <Button
            type="button"
            variant={label ? "outline" : "ghost"}
            size={label ? "sm" : "icon-sm"}
            title="复制"
            className={className}
            onClick={async () => {
                const ok = await copyText(text);
                if (ok) {
                    setCopied(true);
                    toast.success("已复制");
                    setTimeout(() => setCopied(false), 2000);
                } else {
                    toast.error("复制失败");
                }
            }}
        >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {label}
        </Button>
    );
}

function CommandsView({ view }: { view: Extract<InstallView, { kind: "commands" }> }) {
    return (
        <div className="space-y-2">
            <ViewTitle title={view.title} note={view.note} />
            {view.commands.map((cmd) => (
                <div key={cmd} className="relative">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 pr-9 font-mono text-xs">
                        {cmd}
                    </pre>
                    <CopyButton text={cmd} className="absolute right-1.5 top-1.5" />
                </div>
            ))}
            {view.commands.length > 2 ? (
                <CopyButton text={view.commands.join("\n")} label="复制全部命令" />
            ) : null}
        </div>
    );
}

function DeeplinksView({ view }: { view: Extract<InstallView, { kind: "deeplinks" }> }) {
    return (
        <div className="space-y-2">
            <ViewTitle title={view.title} note={view.note} />
            <div className="flex flex-wrap gap-2">
                {view.links.map((l) => (
                    <Button key={l.href} asChild size="sm">
                        <a href={l.href}>{l.label}</a>
                    </Button>
                ))}
            </div>
        </div>
    );
}

function SnippetView({ view }: { view: Extract<InstallView, { kind: "snippet" }> }) {
    return (
        <div className="space-y-2">
            <ViewTitle title={view.title} note={view.note} />
            <p className="text-xs text-muted-foreground">
                合并入 <code className="rounded bg-muted px-1 py-0.5 font-mono">{view.path}</code>
                （勿整体覆盖现有内容）：
            </p>
            <div className="relative">
                <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-9 font-mono text-xs">
                    {view.code}
                </pre>
                <CopyButton text={view.code} className="absolute right-1.5 top-1.5" />
            </div>
        </div>
    );
}

function StepsView({ view }: { view: Extract<InstallView, { kind: "steps" }> }) {
    return (
        <div className="space-y-2">
            <ViewTitle title={view.title} note={view.note} />
            <ol className="list-decimal space-y-1 pl-5 text-sm">
                {view.steps.map((step) => (
                    <li key={step}>{step}</li>
                ))}
            </ol>
        </div>
    );
}
