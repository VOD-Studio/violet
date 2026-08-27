import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, FileText, Search } from "lucide-react";
import type { SeriesSurface } from "../model/mock";
import { CURRENT_CHAPTER, JAVA_BOOK, SHELF_BOOKS } from "../model/mock";

export function TechBookVariant({ surface }: { surface: SeriesSurface }) {
	if (surface === "shelf") return <Shelf />;
	if (surface === "detail") return <Detail />;
	return <Reader />;
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-[760px] overflow-hidden rounded-xl border border-edge-hairline bg-background">
			<header className="flex h-16 items-center justify-between border-b border-edge-hairline px-6">
				<div className="flex items-center gap-3 font-mono text-sm font-semibold">
					<BookOpen className="size-5 text-primary" />
					VIOLET BOOKS
				</div>
				<button
					type="button"
					className="flex items-center gap-2 rounded-lg border border-edge-hairline px-3 py-2 text-sm text-muted-foreground"
				>
					<Search className="size-4" />
					搜索全书 <kbd className="ml-4 font-mono text-xs">⌘ K</kbd>
				</button>
			</header>
			{children}
		</div>
	);
}

function Shelf() {
	return (
		<Shell>
			<div className="mx-auto max-w-5xl px-6 py-14">
				<p className="mb-3 font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
					Technical Library
				</p>
				<h1 className="text-4xl font-bold tracking-tight">在线技术书</h1>
				<p className="mt-3 max-w-2xl text-muted-foreground">
					不是书封陈列，而是可搜索、可连续阅读、持续更新的知识结构。
				</p>
				<div className="mt-12 border-t border-edge-hairline">
					{SHELF_BOOKS.map((book, index) => (
						<article
							key={book.slug}
							className="group grid gap-4 border-b border-edge-hairline py-6 md:grid-cols-[48px_1fr_auto] md:items-center"
						>
							<span className="font-mono text-sm text-muted-foreground/50">
								{String(index + 1).padStart(2, "0")}
							</span>
							<div>
								<h2 className="text-xl font-semibold group-hover:text-primary">
									{book.title}
								</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									{book.subtitle}
								</p>
							</div>
							<div className="flex items-center gap-5 font-mono text-xs text-muted-foreground">
								<span>{book.sections.length} 部</span>
								<span>{book.status === "ongoing" ? "持续更新" : "已完结"}</span>
								<ChevronRight className="size-4" />
							</div>
						</article>
					))}
				</div>
			</div>
		</Shell>
	);
}

function Directory() {
	return (
		<nav className="space-y-6 text-sm">
			{JAVA_BOOK.sections.map((section) => (
				<section key={section.id}>
					<h3 className="mb-2 font-semibold">{section.title}</h3>
					<ol className="space-y-1 border-l border-edge-hairline pl-3">
						{section.chapters.map((item) => (
							<li
								key={item.id}
								className={
									item.current
										? "rounded-r-md border-l-2 border-primary bg-primary/5 px-3 py-2 text-primary"
										: "px-3 py-2 text-muted-foreground hover:text-foreground"
								}
							>
								{item.no}. {item.title}
							</li>
						))}
					</ol>
				</section>
			))}
		</nav>
	);
}

function Detail() {
	return (
		<Shell>
			<div className="grid min-h-[696px] lg:grid-cols-[260px_1fr]">
				<aside className="hidden border-r border-edge-hairline p-6 lg:block">
					<p className="mb-6 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
						目录
					</p>
					<Directory />
				</aside>
				<main className="mx-auto w-full max-w-3xl px-8 py-16">
					<p className="font-mono text-xs text-primary">持续更新 · 2026-06-20</p>
					<h1 className="mt-4 text-5xl font-bold tracking-tight">{JAVA_BOOK.title}</h1>
					<p className="mt-4 text-xl text-muted-foreground">{JAVA_BOOK.subtitle}</p>
					<p className="mt-8 text-lg leading-8 text-muted-foreground">
						{JAVA_BOOK.description}
					</p>
					<div className="mt-8 flex items-center gap-3">
						<button
							type="button"
							className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
						>
							<BookOpen className="size-4" />
							继续阅读
						</button>
						<span className="text-sm text-muted-foreground">第 7 / 12 章</span>
					</div>
					<div className="mt-14 grid gap-4 sm:grid-cols-3">
						<Stat label="章节" value="12" />
						<Stat label="分部" value="3" />
						<Stat label="预计阅读" value="2h 32m" />
					</div>
				</main>
			</div>
		</Shell>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-edge-hairline p-4">
			<p className="font-mono text-xs text-muted-foreground">{label}</p>
			<p className="mt-2 text-2xl font-semibold">{value}</p>
		</div>
	);
}

function Reader() {
	return (
		<Shell>
			<div className="grid min-h-[696px] lg:grid-cols-[280px_1fr_220px]">
				<aside className="hidden overflow-y-auto border-r border-edge-hairline p-6 lg:block">
					<Directory />
				</aside>
				<main className="mx-auto w-full max-w-3xl px-8 py-14">
					<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted-foreground">
						<span>第二部</span>
						<ChevronRight className="size-3" />
						<span>第 7 章</span>
					</div>
					<h1 className="text-4xl font-bold tracking-tight">{CURRENT_CHAPTER.title}</h1>
					<p className="mt-4 text-lg leading-8 text-muted-foreground">
						{CURRENT_CHAPTER.excerpt}
					</p>
					<div className="mt-10 space-y-7 text-[17px] leading-8">
						<h2 className="text-2xl font-semibold">继承解决的是什么</h2>
						<p>
							继承让一个类型获得另一个类型的行为。多态真正解决的是调用方只依赖稳定契约，而不关心运行时对象的具体身份。
						</p>
						<pre className="overflow-x-auto rounded-xl bg-foreground p-5 text-sm text-background">
							<code>{`Animal animal = new Cat();\nanimal.speak(); // 动态分派到 Cat.speak`}</code>
						</pre>
						<h2 className="text-2xl font-semibold">组合为什么更稳</h2>
						<p>
							继承固定纵向关系；组合把能力拆成可替换部件。变化频率不同的职责放在同一条继承链，会让修改沿整棵树扩散。
						</p>
					</div>
					<footer className="mt-16 grid grid-cols-2 gap-4 border-t border-edge-hairline pt-6">
						<button
							type="button"
							className="rounded-lg border border-edge-hairline p-4 text-start"
						>
							<ArrowLeft className="mb-2 size-4" />
							<span className="text-sm text-muted-foreground">上一章</span>
							<strong className="mt-1 block">类、对象与初始化</strong>
						</button>
						<button
							type="button"
							className="rounded-lg border border-edge-hairline p-4 text-end"
						>
							<ArrowRight className="mb-2 ml-auto size-4" />
							<span className="text-sm text-muted-foreground">下一章</span>
							<strong className="mt-1 block">接口与抽象类</strong>
						</button>
					</footer>
				</main>
				<aside className="hidden border-l border-edge-hairline p-6 lg:block">
					<p className="mb-5 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
						本章目录
					</p>
					<ol className="space-y-3 text-sm text-muted-foreground">
						{CURRENT_CHAPTER.anchors.map((anchor, i) => (
							<li key={anchor} className={i === 0 ? "font-medium text-primary" : ""}>
								{anchor}
							</li>
						))}
					</ol>
					<div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
						<FileText className="size-4" />
						18 min
					</div>
				</aside>
			</div>
		</Shell>
	);
}
