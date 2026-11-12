import type { InstallView } from "@features/admin-mcp/model/clients";
import { Button, CodeBlock, InlineCode } from "@violet/ui";

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

function CommandsView({ view }: { view: Extract<InstallView, { kind: "commands" }> }) {
	return (
		<div className="space-y-2">
			<ViewTitle title={view.title} note={view.note} />
			<CodeBlock code={view.commands.join("\n")} language="bash" className="my-6" />
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
				合并入 <InlineCode>{view.path}</InlineCode>
				（勿整体覆盖现有内容）：
			</p>
			<CodeBlock
				code={view.code}
				language={view.lang}
				filename={view.path}
				className="my-6"
			/>
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
