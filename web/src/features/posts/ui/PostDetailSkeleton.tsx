const LINE_WIDTHS = [100, 94, 88, 98, 72, 96, 84, 91];

/** 文章详情数据加载期间的页面级骨架。 */
export function PostDetailSkeleton() {
	return (
		<article
			aria-label="正在加载文章"
			className="container mx-auto max-w-4xl animate-pulse px-6 py-16 xl:max-w-308"
		>
			<div className="min-w-0 xl:max-w-230">
				<div className="mb-8 h-4 w-20 rounded bg-muted" />
				<header className="mb-12">
					<div className="mb-5 flex gap-2">
						<div className="h-5 w-16 rounded-full bg-muted" />
						<div className="h-5 w-20 rounded-full bg-muted" />
					</div>
					<div className="mb-3 h-12 w-4/5 rounded-lg bg-muted md:h-14" />
					<div className="mb-6 h-12 w-3/5 rounded-lg bg-muted md:h-14" />
					<div className="flex items-center gap-4">
						<div className="size-7 rounded-full bg-muted" />
						<div className="h-4 w-24 rounded bg-muted" />
						<div className="h-4 w-32 rounded bg-muted" />
					</div>
				</header>
				<div className="mb-9 aspect-2/1 rounded-2xl bg-muted/70" />
				<div className="space-y-4">
					{LINE_WIDTHS.map((width) => (
						<div
							key={width}
							className="h-4 rounded bg-muted"
							style={{ width: `${width}%` }}
						/>
					))}
				</div>
			</div>
		</article>
	);
}
