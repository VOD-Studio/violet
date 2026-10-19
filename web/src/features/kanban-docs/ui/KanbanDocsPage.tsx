import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { PageShell } from "@violet/ui";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import packageJson from "../../../../packages/kanban/package.json";
import { KANBAN_API_DOC, KANBAN_API_OUTLINE } from "../lib/api-doc";
import { KANBAN_EXAMPLES } from "../model/examples";
import { KanbanExampleBlock } from "./KanbanExampleBlock";

const SOURCE_URL = "https://github.com/VOD-Studio/violet/tree/release/2.0/web/packages/kanban";

const LINK =
	"inline-flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const INSTALL = `包还没有发布到 npm，\`package.json\` 里的版本号不代表 registry 里已有。

**本仓库内**的应用用 workspace 依赖：

\`\`\`json
{ "dependencies": { "@violetjs/kanban": "workspace:*" } }
\`\`\`

**仓库外**先打出真实 tarball，再按文件安装（应用需要 React 19 与能处理 CSS 导入的构建工具）：

\`\`\`bash
make kanban-pack NPM_PACK_DEST=/absolute/output/directory
pnpm add /absolute/output/directory/violetjs-kanban-${packageJson.version}.tgz
\`\`\`

根入口自动带上默认样式；用 \`@violetjs/kanban/unstyled\` 等无样式入口时，单独导入一次样式：

\`\`\`tsx
import { Board } from "@violetjs/kanban/unstyled";
import "@violetjs/kanban/styles.css";
\`\`\`
`;

function Section({
	id,
	title,
	lead,
	children,
}: {
	id: string;
	title: string;
	lead?: string;
	children: ReactNode;
}) {
	return (
		<section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
			<h2 id={`${id}-heading`} className="text-2xl font-normal tracking-[-0.02em]">
				{title}
			</h2>
			{lead ? (
				<p className="mt-2 max-w-2xl font-reading leading-relaxed text-muted-foreground">
					{lead}
				</p>
			) : null}
			<div className="mt-8">{children}</div>
		</section>
	);
}

/** `/kanban`：@violetjs/kanban 的演示、安装与 API。演示全用本地状态，不连后端。 */
export function KanbanDocsPage() {
	return (
		<PageShell>
			<header className="border-b border-border/40 pb-8 md:pb-10">
				<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
					Package
				</p>
				<h1 className="mt-2 text-4xl leading-tight font-normal tracking-[-0.03em] sm:text-5xl">
					看板
				</h1>
				<p className="mt-3 font-mono text-xs text-muted-foreground">
					{packageJson.name} · {packageJson.version} · 未发布到 npm
				</p>
				<p className="mt-4 max-w-2xl font-reading leading-relaxed text-muted-foreground">
					{
						"React 19 受控看板与关系图，另有不依赖 React 的核心函数。卡片、列顺序、持久化和权限由使用方管理；包负责呈现与报告操作。本站项目页的路线图就是用它画的。"
					}
				</p>
				<nav
					aria-label="本页目录"
					className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs"
				>
					<a href="#demo" className={LINK}>
						演示
					</a>
					<a href="#install" className={LINK}>
						安装
					</a>
					<a href="#api" className={LINK}>
						API
					</a>
					<a href={SOURCE_URL} target="_blank" rel="noreferrer" className={LINK}>
						源码
						<ArrowUpRight className="size-3.5" aria-hidden="true" />
					</a>
				</nav>
			</header>

			<div className="mt-12 space-y-20 md:mt-16">
				<Section
					id="demo"
					title="演示"
					lead="下面四个演示就是包里 examples/ 的原样代码，状态都在本地，刷新即复原，不连接任何后端。"
				>
					<div className="space-y-16">
						{KANBAN_EXAMPLES.map((example) => (
							<KanbanExampleBlock key={example.id} example={example} />
						))}
					</div>
				</Section>
				<Section id="install" title="安装">
					<MarkdownContent content={INSTALL} className="max-w-3xl font-reading" />
				</Section>
				<Section id="api" title="API" lead="与包内 docs/api.md 同一份正文。">
					<div className="xl:grid xl:grid-cols-[minmax(0,48rem)_13rem] xl:justify-between xl:gap-12">
						<MarkdownContent
							content={KANBAN_API_DOC}
							className="min-w-0 font-reading"
						/>
						<nav aria-label="API 目录" className="hidden xl:block">
							{/* 目录比视口高时在自身里滚动；-m-1 p-1 给链接的聚焦环留出位置，不被裁掉 */}
							<ul className="sticky top-24 -m-1 max-h-[calc(100dvh-8rem)] space-y-2 overflow-y-auto p-1 font-mono text-xs">
								{KANBAN_API_OUTLINE.map((section) => (
									<li key={section.id}>
										<a href={`#${section.id}`} className={LINK}>
											{section.title}
										</a>
									</li>
								))}
							</ul>
						</nav>
					</div>
				</Section>
			</div>
		</PageShell>
	);
}
