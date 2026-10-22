import { CodeCard } from "@shared/ui/code-preview";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Button, Segmented } from "@violet/ui";
import { cn } from "cn";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import packageJson from "../../../../packages/inkline/package.json";
import { EXAMPLE_CODE } from "../lib/examples";
import { exportCode } from "../lib/export-code";
import {
	SECTIONS,
	type SectionId,
	sectionFromPath,
	type WorkbenchSection,
} from "../model/sections";
import { useWorkbenchStore } from "../model/workbench-store";
import { ArtworkParams } from "./ArtworkParams";
import { ArtworkStage } from "./ArtworkStage";
import {
	FillsStage,
	HandsParams,
	HandsStage,
	PaletteParams,
	PaletteStage,
	PensParams,
	PensStage,
	QuickStartStage,
	RedrawStage,
} from "./demos";
import { ExportPanel } from "./ExportPanel";

type PanelTab = "params" | "export" | "code";

const PANEL_TABS: { value: PanelTab; label: string }[] = [
	{ value: "params", label: "参数" },
	{ value: "export", label: "导出" },
	{ value: "code", label: "代码" },
];

const INSTALL = "pnpm add @violetjs/inkline";
const SOURCE = "https://github.com/VOD-Studio/violet/tree/release/2.0/web/packages/inkline";
const LINKS = [
	{ label: "README", href: `${SOURCE}#readme` },
	{ label: "API 文档", href: `${SOURCE}/docs/api.zh-CN.md` },
	{ label: "npm", href: "https://www.npmjs.com/package/@violetjs/inkline" },
];

const DEMO_STAGES: Partial<Record<SectionId, ComponentType>> = {
	"quick-start": QuickStartStage,
	pens: PensStage,
	hands: HandsStage,
	fills: FillsStage,
	redraw: RedrawStage,
	palette: PaletteStage,
};

const PARAMS: Partial<Record<SectionId, ComponentType>> = {
	artwork: ArtworkParams,
	export: ArtworkParams,
	pens: PensParams,
	hands: HandsParams,
	palette: PaletteParams,
};

const PALETTE_CODE = `import { mountSvg, updateSvgPalette } from "@violetjs/inkline/svg";

const svg = mountSvg(drawing, light); // 角色：paper、ink、grass、sun…
host.append(svg);

// 切换主题时只按角色改写颜色，笔画不重新生成
updateSvgPalette(svg, dark);`;

const LINK_FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * @violetjs/inkline 的包演示页：左侧能力目录，中间舞台，右侧参数、导出与代码；
 * 窄屏时舞台占满，目录与面板由底部按钮以浮层打开。
 */
export function InklineWorkbench() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const section = sectionFromPath(pathname);
	const [tab, setTab] = useState<PanelTab>(section.id === "export" ? "export" : "params");
	const [overlay, setOverlay] = useState<PanelTab | "sections" | null>(null);

	useEffect(() => {
		setTab(section.id === "export" ? "export" : "params");
		setOverlay(null);
	}, [section.id]);

	const Stage = DEMO_STAGES[section.id];

	return (
		<div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
			<Outlet />
			<aside className="hidden min-h-0 flex-col border-r border-border lg:flex">
				<Brand />
				<SectionNav current={section} className="min-h-0 flex-1 overflow-y-auto p-3" />
				<ExternalLinks className="border-t border-border px-5 py-4" />
			</aside>

			{/* 窄屏底部留出站点导航岛（52px 高、距底至少 0.75rem）的位置，面板按钮排在它上方 */}
			<section
				className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 pb-[calc(3.25rem+max(0.75rem,env(safe-area-inset-bottom))+0.75rem)] lg:p-6"
				aria-labelledby="workbench-title"
			>
				<header className="grid gap-1">
					<h1 id="workbench-title" className="text-xl font-semibold tracking-tight">
						{section.title}
					</h1>
					<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
						{section.summary}
					</p>
				</header>
				<div className="min-h-0 flex-1">
					{Stage ? (
						// m-auto 居中：内容超高时从顶部开始滚动，不像 place-items-center 那样裁掉上半截
						<div className="flex size-full overflow-auto rounded-2xl border border-border bg-card p-6">
							<div className="m-auto w-full">
								<Stage />
							</div>
						</div>
					) : (
						<ArtworkStage />
					)}
				</div>
				<nav aria-label="工作台面板" className="flex gap-2 lg:hidden">
					<Button variant="outline" size="sm" onClick={() => setOverlay("sections")}>
						目录
					</Button>
					{PANEL_TABS.map((item) => (
						<Button
							key={item.value}
							variant="ghost"
							size="sm"
							onClick={() => setOverlay(item.value)}
						>
							{item.label}
						</Button>
					))}
				</nav>
			</section>

			<aside
				className="hidden min-h-0 flex-col gap-4 border-l border-border p-4 lg:flex"
				aria-label="参数、导出与代码"
			>
				<Segmented<PanelTab>
					aria-label="面板"
					block
					value={tab}
					onValueChange={setTab}
					segments={PANEL_TABS}
				/>
				<div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1">
					<Panel tab={tab} section={section} />
				</div>
			</aside>

			{overlay && (
				<Overlay
					title={
						overlay === "sections"
							? "目录"
							: (PANEL_TABS.find((t) => t.value === overlay)?.label ?? "")
					}
					onClose={() => setOverlay(null)}
				>
					{overlay === "sections" ? (
						<>
							<Brand />
							<SectionNav current={section} />
						</>
					) : (
						<Panel tab={overlay} section={section} />
					)}
				</Overlay>
			)}
		</div>
	);
}

function Panel({ tab, section }: { tab: PanelTab; section: WorkbenchSection }) {
	if (tab === "export")
		return (
			<div className="grid gap-4">
				<p className="text-xs leading-relaxed text-muted-foreground">
					导出当前画稿与编排；画稿与编排在「画稿与时间轴」的参数里切换。
				</p>
				<ExportPanel />
			</div>
		);
	if (tab === "code") return <SectionCode section={section} />;
	const Params = PARAMS[section.id];
	return Params ? (
		<Params />
	) : (
		<p className="text-sm text-muted-foreground">这一节没有可调参数，可以看看代码。</p>
	);
}

function SectionCode({ section }: { section: WorkbenchSection }) {
	const settings = useWorkbenchStore((s) => s.exportSettings);
	const blocks: { title: string; code: string }[] = {
		artwork: [{ title: "examples/animation.ts", code: EXAMPLE_CODE.animation }],
		export: [{ title: "按当前参数导出", code: exportCode(settings) }],
		"quick-start": [{ title: "examples/quick-start.ts", code: EXAMPLE_CODE.quickStart }],
		pens: [{ title: "examples/pens.ts", code: EXAMPLE_CODE.pens }],
		hands: [{ title: "examples/hands.ts", code: EXAMPLE_CODE.hands }],
		fills: [
			{ title: "examples/fills.ts", code: EXAMPLE_CODE.fills },
			{ title: "examples/line-wash.ts", code: EXAMPLE_CODE.lineWash },
		],
		redraw: [{ title: "examples/mermaid.ts", code: EXAMPLE_CODE.mermaid }],
		palette: [{ title: "换色", code: PALETTE_CODE }],
	}[section.id];
	return (
		<div className="grid gap-3">
			{blocks.map((block) => (
				<CodeCard
					key={block.title}
					title={block.title}
					code={block.code}
					language="ts"
					collapseLines={0}
				/>
			))}
			<p className="text-xs text-muted-foreground">
				示例与包 README 同源，改动时两边一起更新。
			</p>
		</div>
	);
}

function Brand() {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(INSTALL);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// 剪贴板不可用（非安全上下文）时不提示，命令本身可选中复制
		}
	};
	return (
		<div className="grid min-w-0 gap-2 border-b border-border px-5 py-5">
			<div className="flex items-baseline gap-2">
				<span className="text-lg font-semibold tracking-tight">inkline</span>
				<span className="font-mono text-xs text-muted-foreground">
					{packageJson.version}
				</span>
			</div>
			<p className="text-xs leading-relaxed text-muted-foreground">
				手绘矢量墨线：笔、手法、填充、时间轴与动画导出。
			</p>
			<div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-muted/40 py-1 pr-1 pl-2.5">
				<code className="min-w-0 flex-1 truncate font-mono text-xs select-all">
					{INSTALL}
				</code>
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={copy}
					aria-label={copied ? "已复制" : "复制安装命令"}
				>
					{copied ? <Check aria-hidden /> : <Copy aria-hidden />}
				</Button>
			</div>
		</div>
	);
}

function SectionNav({ current, className }: { current: WorkbenchSection; className?: string }) {
	return (
		<nav aria-label="inkline 能力" className={className}>
			<ol className="grid gap-0.5">
				{SECTIONS.map((section, index) => {
					const active = section.id === current.id;
					const itemClass = cn(
						"flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
						LINK_FOCUS,
						active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
					);
					const label = (
						<>
							<span className="font-mono text-xs text-muted-foreground tabular-nums">
								{String(index + 1).padStart(2, "0")}
							</span>
							{section.title}
						</>
					);
					return (
						<li key={section.id}>
							{section.slug ? (
								<Link
									to="/inkline/$section"
									params={{ section: section.slug }}
									aria-current={active ? "page" : undefined}
									className={itemClass}
								>
									{label}
								</Link>
							) : (
								<Link
									to="/inkline"
									aria-current={active ? "page" : undefined}
									className={itemClass}
								>
									{label}
								</Link>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

function ExternalLinks({ className }: { className?: string }) {
	return (
		<ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
			{LINKS.map((link) => (
				<li key={link.label}>
					<a
						href={link.href}
						target="_blank"
						rel="noreferrer"
						className={cn(
							"inline-flex items-center gap-0.5 rounded-sm text-muted-foreground hover:text-primary",
							LINK_FOCUS,
						)}
					>
						{link.label}
						<ArrowUpRight aria-hidden className="size-3" />
					</a>
				</li>
			))}
		</ul>
	);
}

/** 窄屏浮层：淡入，Esc 或点背景关闭，关闭后焦点回到打开它的按钮。 */
function Overlay({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const panel = useRef<HTMLDivElement>(null);
	// 父组件每次渲染都传新的回调，读最新值即可，焦点只在打开与关闭时移动一次
	const close = useRef(onClose);
	close.current = onClose;
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		panel.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close.current();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			opener?.focus();
		};
	}, []);
	return (
		<div className="fixed inset-0 z-60 lg:hidden">
			<button
				type="button"
				aria-label="关闭"
				tabIndex={-1}
				className="absolute inset-0 animate-in bg-background/70 fade-in"
				onClick={onClose}
			/>
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className="absolute inset-x-0 bottom-0 grid max-h-[80dvh] animate-in grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-t-2xl border-t border-border bg-card px-4 pt-3 pb-6 fade-in focus-visible:outline-none"
			>
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">{title}</span>
					<Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭面板">
						<X aria-hidden />
					</Button>
				</div>
				<div className="-mx-1 overflow-y-auto px-1 pb-1">{children}</div>
			</div>
		</div>
	);
}
