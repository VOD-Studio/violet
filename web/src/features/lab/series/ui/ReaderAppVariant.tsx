import { ArrowLeft, BookOpen, ChevronDown, Clock3, Search } from "lucide-react";
import type { MockBook, SeriesSurface } from "../model/mock";
import { CURRENT_CHAPTER, JAVA_BOOK, SHELF_BOOKS } from "../model/mock";
import { BookCover } from "./BookCover";

export function ReaderAppVariant({ surface }: { surface: SeriesSurface }) {
	if (surface === "shelf") return <Shelf />;
	if (surface === "detail") return <Detail />;
	return <Reader />;
}

function Shelf() {
	return (
		<div className="min-h-[720px] rounded-3xl bg-background p-6 text-foreground md:p-10">
			<div className="mx-auto max-w-6xl">
				<header className="mb-10 flex items-end justify-between">
					<div>
						<p className="mb-2 font-mono text-xs tracking-[0.25em] opacity-50 uppercase">
							My Library
						</p>
						<h1 className="text-4xl font-semibold tracking-tight">书架</h1>
					</div>
					<button type="button" className="rounded-full border border-current/15 p-3">
						<Search className="size-5" />
					</button>
				</header>

				<section className="mb-14 grid items-center gap-7 rounded-3xl border border-border bg-card p-6 md:grid-cols-[144px_minmax(0,1fr)_auto] md:p-8">
					<BookCover
						book={JAVA_BOOK}
						size="sm"
						className="w-36 justify-self-center md:justify-self-start"
					/>
					<div>
						<p className="mb-2 text-sm opacity-55">继续阅读 · 第二部</p>
						<h2 className="text-2xl font-semibold">{CURRENT_CHAPTER.title}</h2>
						<p className="mt-2 text-sm opacity-65">
							《{JAVA_BOOK.title}》· 第 {CURRENT_CHAPTER.no} 章
						</p>
						<div className="mt-5 h-1.5 max-w-xs rounded-full bg-muted">
							<div className="h-full w-[46%] rounded-full bg-primary" />
						</div>
					</div>
					<button
						type="button"
						className="flex items-center gap-2 justify-self-start rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground md:justify-self-end"
					>
						<BookOpen className="size-4" />
						继续阅读
					</button>
				</section>

				<h2 className="mb-6 text-lg font-semibold">全部书籍</h2>
				<div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
					{SHELF_BOOKS.map((book) => (
						<ShelfBook key={book.slug} book={book} />
					))}
				</div>
			</div>
		</div>
	);
}

function readingState(book: MockBook) {
	if (book.progress <= 0) return "尚未开始";
	if (book.progress >= 100) return "已读完";
	return `已读 ${book.progress}%`;
}

function ShelfBook({ book }: { book: MockBook }) {
	return (
		<article className="mx-auto w-full max-w-56">
			<BookCover book={book} className="w-full" />
			<h3 className="mt-4 line-clamp-1 font-semibold">{book.title}</h3>
			<div className="mt-1.5 flex items-center justify-between gap-3 text-sm opacity-55">
				<span className="truncate">{book.author}</span>
				<span className="shrink-0">{readingState(book)}</span>
			</div>
		</article>
	);
}

function Detail() {
	return (
		<div className="min-h-[760px] rounded-3xl bg-background p-6 text-foreground md:p-12">
			<button type="button" className="mb-10 flex items-center gap-2 text-sm opacity-60">
				<ArrowLeft className="size-4" />
				返回书架
			</button>
			<header className="grid gap-10 md:grid-cols-[220px_1fr]">
				<BookCover book={JAVA_BOOK} size="lg" className="w-full" />
				<div className="flex flex-col justify-center">
					<p className="mb-3 text-sm opacity-55">连载中 · 12 章 · 最近更新 2026-06-20</p>
					<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
						{JAVA_BOOK.title}
					</h1>
					<p className="mt-3 text-lg opacity-65">{JAVA_BOOK.subtitle}</p>
					<p className="mt-6 max-w-2xl leading-7 opacity-75">{JAVA_BOOK.description}</p>
					<p className="mt-5 text-sm opacity-55">作者 · {JAVA_BOOK.author}</p>
					<div className="mt-8 flex flex-wrap items-center gap-3">
						<button
							type="button"
							className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground"
						>
							<BookOpen className="size-4" />
							继续阅读第 7 章
						</button>
						<span className="text-sm opacity-55">已读 46%</span>
					</div>
				</div>
			</header>
			<BookDirectory className="mt-14" />
		</div>
	);
}

function BookDirectory({ className = "" }: { className?: string }) {
	return (
		<section className={className}>
			<div className="mb-6 flex items-baseline justify-between border-b border-border pb-4">
				<h2 className="text-2xl font-semibold">目录</h2>
				<span className="text-sm opacity-50">3 部 · 12 章</span>
			</div>
			{JAVA_BOOK.sections.map((section) => (
				<div key={section.id} className="border-b border-current/10 py-5">
					<h3 className="mb-3 flex items-center justify-between font-semibold">
						<span>{section.title}</span>
						<ChevronDown className="size-4 opacity-45" />
					</h3>
					<ol className="space-y-1">
						{section.chapters.map((item) => (
							<li
								key={item.id}
								className={
									item.current ? "rounded-lg bg-muted px-3 py-2.5" : "px-3 py-2.5"
								}
							>
								<div className="flex items-center gap-3">
									<span className="w-7 font-mono text-xs opacity-40">
										{String(item.no).padStart(2, "0")}
									</span>
									<span className="flex-1">{item.title}</span>
									<span className="flex items-center gap-1 text-xs opacity-45">
										<Clock3 className="size-3" />
										{item.readMinutes} min
									</span>
								</div>
							</li>
						))}
					</ol>
				</div>
			))}
		</section>
	);
}

function Reader() {
	return (
		<div className="min-h-[820px] overflow-hidden rounded-3xl border border-border bg-background text-foreground">
			<header className="flex items-center justify-between border-b border-current/10 px-6 py-4">
				<span className="text-sm opacity-55">{JAVA_BOOK.title}</span>
				<span className="font-mono text-xs opacity-45">46%</span>
			</header>
			<div className="grid min-h-[760px] lg:grid-cols-[260px_1fr_210px]">
				<aside className="hidden border-r border-border p-5 lg:block">
					<p className="mb-5 font-mono text-[11px] tracking-[0.2em] opacity-45 uppercase">
						全书目录
					</p>
					<BookDirectory />
				</aside>
				<main className="mx-auto w-full max-w-3xl px-7 py-14 md:px-12">
					<p className="mb-5 font-mono text-xs tracking-[0.2em] opacity-45 uppercase">
						第二部 · 第 07 章
					</p>
					<h1 className="text-4xl font-semibold tracking-tight">
						{CURRENT_CHAPTER.title}
					</h1>
					<p className="mt-4 text-lg leading-8 opacity-65">{CURRENT_CHAPTER.excerpt}</p>
					<div className="mt-10 space-y-7 text-[17px] leading-8 opacity-90">
						<p>
							继承让一个类型获得另一个类型的行为，但多态真正解决的是：调用方能否只依赖一份稳定契约，而不关心运行时对象的具体身份。
						</p>
						<h2 className="pt-4 text-2xl font-semibold">动态分派发生在哪里</h2>
						<p>
							编译器能够确定方法签名，却把最终实现的选择留到运行时。理解这一点，比记住「父类引用指向子类对象」更接近机制本身。
						</p>
						<h2 className="pt-4 text-2xl font-semibold">组合为什么更稳</h2>
						<p>
							继承固定了纵向关系；组合把能力拆成可替换部件。变化频率不同的职责放在一条继承链里，修改会沿整棵树扩散。
						</p>
					</div>
					<footer className="mt-16 grid grid-cols-2 gap-4 border-t border-current/10 pt-6">
						<button type="button" className="text-start text-sm opacity-60">
							← 第 6 章<br />
							<strong className="mt-1 block text-base opacity-100">
								类、对象与初始化
							</strong>
						</button>
						<button type="button" className="text-end text-sm opacity-60">
							第 8 章 →<br />
							<strong className="mt-1 block text-base opacity-100">
								接口与抽象类
							</strong>
						</button>
					</footer>
				</main>
				<aside className="hidden border-l border-border p-6 lg:block">
					<p className="mb-5 font-mono text-[11px] tracking-[0.2em] opacity-45 uppercase">
						本章
					</p>
					<ol className="space-y-3 text-sm opacity-55">
						{CURRENT_CHAPTER.anchors.map((anchor, index) => (
							<li
								key={anchor}
								className={index === 0 ? "font-medium opacity-100" : ""}
							>
								{anchor}
							</li>
						))}
					</ol>
				</aside>
			</div>
		</div>
	);
}
