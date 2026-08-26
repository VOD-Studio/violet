import { ArrowLeft, ArrowRight } from "lucide-react";
import type { MockBook, SeriesSurface } from "../model/mock";
import { CURRENT_CHAPTER, JAVA_BOOK, SHELF_BOOKS } from "../model/mock";
import { BookCover } from "./BookCover";

export function EditorialVariant({ surface }: { surface: SeriesSurface }) {
	if (surface === "shelf") return <Shelf />;
	if (surface === "detail") return <Detail />;
	return <Reader />;
}

const serif = "font-serif";

function Shelf() {
	return (
		<div className="min-h-[760px] rounded-sm bg-[#f2eee5] px-7 py-12 text-[#27231d] md:px-14 dark:bg-[#1d1b17] dark:text-[#eee9df]">
			<header className="mb-16 border-y border-current/25 py-8 text-center">
				<p className="font-mono text-[10px] tracking-[0.35em] opacity-50 uppercase">
					Violet Editions · Online Books
				</p>
				<h1 className={`${serif} mt-3 text-5xl`}>书目</h1>
			</header>
			<div className="space-y-14">
				{SHELF_BOOKS.map((book, index) => (
					<CatalogueRow key={book.slug} book={book} index={index} />
				))}
			</div>
		</div>
	);
}

function CatalogueRow({ book, index }: { book: MockBook; index: number }) {
	return (
		<article className="grid items-start gap-6 border-b border-current/20 pb-12 md:grid-cols-[72px_150px_1fr_auto]">
			<span className="font-mono text-xs opacity-40">
				{String(index + 1).padStart(2, "0")}
			</span>
			<BookCover book={book} className="w-36 shadow-md" />
			<div>
				<p className="mb-2 font-mono text-[10px] tracking-[0.25em] opacity-45 uppercase">
					{book.status === "ongoing" ? "Serial Edition" : "Complete Edition"}
				</p>
				<h2 className={`${serif} text-3xl leading-tight`}>{book.title}</h2>
				<p className={`${serif} mt-2 text-lg italic opacity-65`}>{book.subtitle}</p>
				<p className="mt-5 max-w-xl text-sm leading-7 opacity-65">{book.description}</p>
			</div>
			<div className="font-mono text-[10px] leading-6 opacity-45">
				<p>{book.author}</p>
				<p>{book.sections.length} PARTS</p>
				<p>{book.progress}% READ</p>
			</div>
		</article>
	);
}

function Detail() {
	return (
		<div className="min-h-[800px] rounded-sm bg-[#f2eee5] px-7 py-12 text-[#27231d] md:px-16 dark:bg-[#1d1b17] dark:text-[#eee9df]">
			<p className="mb-12 text-center font-mono text-[10px] tracking-[0.35em] opacity-45 uppercase">
				Violet Editions · No. 001
			</p>
			<header className="mx-auto max-w-4xl text-center">
				<p className="font-mono text-xs tracking-[0.25em] opacity-50 uppercase">
					A Living Technical Book
				</p>
				<h1 className={`${serif} mt-6 text-5xl leading-tight md:text-7xl`}>
					{JAVA_BOOK.title}
				</h1>
				<p className={`${serif} mt-5 text-xl italic opacity-65`}>{JAVA_BOOK.subtitle}</p>
				<div className="mx-auto mt-8 h-px w-20 bg-current/40" />
				<p className="mt-7 text-sm tracking-wide opacity-60">
					{JAVA_BOOK.author} 著 · 连载中 · 2026
				</p>
				<p className="mx-auto mt-10 max-w-2xl text-start text-[17px] leading-8 opacity-75 first-letter:float-left first-letter:mr-2 first-letter:text-5xl first-letter:leading-[0.85]">
					{JAVA_BOOK.description}
				</p>
			</header>
			<section className="mx-auto mt-20 max-w-4xl">
				<div className="mb-10 flex items-baseline justify-between border-b border-current/30 pb-4">
					<h2 className={`${serif} text-4xl`}>目录</h2>
					<span className="font-mono text-[10px] tracking-[0.2em] opacity-45">
						CONTENTS
					</span>
				</div>
				{JAVA_BOOK.sections.map((section, sectionIndex) => (
					<div key={section.id} className="mb-12 grid gap-5 md:grid-cols-[180px_1fr]">
						<div>
							<p className="font-mono text-[10px] tracking-[0.2em] opacity-40">
								PART {String(sectionIndex + 1).padStart(2, "0")}
							</p>
							<h3 className={`${serif} mt-2 text-xl`}>
								{section.title.replace(/^第.部 · /, "")}
							</h3>
						</div>
						<ol>
							{section.chapters.map((item) => (
								<li
									key={item.id}
									className="flex items-baseline gap-4 border-b border-current/15 py-3"
								>
									<span className="font-mono text-xs opacity-40">
										{String(item.no).padStart(2, "0")}
									</span>
									<span className={`${serif} flex-1 text-lg`}>{item.title}</span>
									<span className="font-mono text-[10px] opacity-35">
										{item.readMinutes} MIN
									</span>
								</li>
							))}
						</ol>
					</div>
				))}
			</section>
		</div>
	);
}

function Reader() {
	return (
		<div className="min-h-[850px] rounded-sm bg-[#f7f3eb] text-[#27231d] dark:bg-[#1d1b17] dark:text-[#eee9df]">
			<header className="flex items-center justify-between border-b border-current/15 px-8 py-4 font-mono text-[10px] tracking-[0.2em] opacity-45 uppercase">
				<span>{JAVA_BOOK.title}</span>
				<span>Chapter {CURRENT_CHAPTER.no}</span>
			</header>
			<div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_1fr]">
				<aside className="hidden border-r border-current/15 p-7 lg:block">
					<p className="mb-7 font-mono text-[10px] tracking-[0.25em] opacity-40 uppercase">
						Contents
					</p>
					{JAVA_BOOK.sections.map((section) => (
						<section key={section.id} className="mb-6">
							<h3 className={`${serif} mb-2 text-sm font-semibold`}>
								{section.title}
							</h3>
							<ol className="space-y-2 text-sm opacity-55">
								{section.chapters.map((item) => (
									<li
										key={item.id}
										className={item.current ? "font-semibold opacity-100" : ""}
									>
										{item.no}. {item.title}
									</li>
								))}
							</ol>
						</section>
					))}
				</aside>
				<main className="mx-auto w-full max-w-3xl px-8 py-16 md:px-16">
					<p className="text-center font-mono text-[10px] tracking-[0.3em] opacity-40 uppercase">
						第二部 · 对象世界
					</p>
					<p className={`${serif} mt-10 text-center text-8xl opacity-15`}>
						{String(CURRENT_CHAPTER.no).padStart(2, "0")}
					</p>
					<h1 className={`${serif} -mt-9 text-center text-5xl leading-tight`}>
						{CURRENT_CHAPTER.title}
					</h1>
					<p
						className={`${serif} mx-auto mt-8 max-w-xl text-center text-xl italic leading-8 opacity-60`}
					>
						{CURRENT_CHAPTER.excerpt}
					</p>
					<div className="mx-auto mt-12 h-px w-16 bg-current/40" />
					<div className={`${serif} mt-12 space-y-8 text-[18px] leading-9`}>
						<p className="first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:leading-[0.8]">
							继承让一个类型获得另一个类型的行为，但多态真正解决的是调用方能否只依赖稳定契约，而不关心运行时对象的具体身份。
						</p>
						<h2 className="pt-6 text-3xl">动态分派发生在哪里</h2>
						<p>
							编译器能够确定方法签名，却把最终实现的选择留到运行时。理解机制，比记住「父类引用指向子类对象」更重要。
						</p>
						<h2 className="pt-6 text-3xl">组合为什么更稳</h2>
						<p>
							继承固定纵向关系；组合把能力拆成可替换部件。变化频率不同的职责放在同一条继承链里，修改会沿整棵树扩散。
						</p>
					</div>
					<footer className="mt-20 grid grid-cols-2 border-t border-current/20 pt-7">
						<button type="button" className="text-start">
							<ArrowLeft className="mb-3 size-4 opacity-45" />
							<span className="font-mono text-[10px] opacity-40">PREVIOUS</span>
							<strong className={`${serif} mt-1 block text-lg`}>
								类、对象与初始化
							</strong>
						</button>
						<button type="button" className="text-end">
							<ArrowRight className="mb-3 ml-auto size-4 opacity-45" />
							<span className="font-mono text-[10px] opacity-40">NEXT</span>
							<strong className={`${serif} mt-1 block text-lg`}>接口与抽象类</strong>
						</button>
					</footer>
				</main>
			</div>
		</div>
	);
}
