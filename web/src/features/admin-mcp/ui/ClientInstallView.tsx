import type { InstallView } from "@features/admin-mcp/model/clients";
import { Button } from "@shared/ui/base/button";
import { lazy, Suspense } from "react";

/**
 * FencedCodeBlock 懒加载：与 markdown-components 同理，避免 shiki 高亮链
 * 进入 admin 主 chunk，仅接入面板真正渲染代码块时拉取。
 */
const LazyFencedCodeBlock = lazy(() =>
    import("@shared/ui/markdown-preview/components/CodeBlock").then((m) => ({
        default: m.FencedCodeBlock,
    })),
);

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

function CodeBlock({ code, language }: { code: string; language: string }) {
    return (
        <Suspense fallback={<div className="my-6 h-24 animate-pulse rounded-lg bg-muted" />}>
            <LazyFencedCodeBlock code={code} language={language} />
        </Suspense>
    );
}

function ViewTitle({ title, note }: { title: string; note?: string }) {
    return (
        <div className="space-y-0.5">
            <p className="text-sm font-medium">{title}</p>
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </div>
    );
}

function CommandsView({ view }: { view: Extract<InstallView, { kind: "commands" }> }) {
    return (
        <div className="space-y-2">
            <ViewTitle title={view.title} note={view.note} />
            <CodeBlock code={view.commands.join("\n")} language="bash" />
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
            <CodeBlock code={view.code} language={view.lang} />
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
