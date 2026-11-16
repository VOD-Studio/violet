import { Skeleton } from "@violet/ui";

/** 首页身份数据等待期间的静态占位。 */
export function HomePreludeSkeleton() {
	return (
		<section
			aria-label="正在加载个人简介"
			className="relative flex min-h-[calc(100svh-8rem)] w-full flex-col text-foreground lg:min-h-[calc(100svh-4rem)]"
		>
			<div className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-16 sm:px-8 md:py-20 lg:px-12">
				<div className="grid w-full items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14 lg:gap-16">
					<div className="flex justify-center md:justify-start">
						<Skeleton className="size-48 rounded-xl border border-border/40 sm:size-56 lg:size-60" />
					</div>

					<div className="min-w-0 space-y-5">
						<Skeleton className="h-12 w-4/5 rounded-xl sm:h-14 lg:h-16" />

						<div className="space-y-2.5">
							<Skeleton className="h-4.5 w-full rounded" />
							<Skeleton className="h-4.5 w-4/5 rounded" />
						</div>

						<Skeleton className="h-4 w-4/5 rounded" />

						<div className="flex flex-wrap gap-2.5 pt-1">
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-16 rounded-full border border-border/50" />
						</div>
					</div>
				</div>
			</div>

			<div className="relative z-10 border-t border-border/40 bg-background/50 py-3.5">
				<div className="mx-auto flex max-w-296 flex-wrap justify-between gap-6 px-5 sm:px-8">
					<Skeleton className="h-4 w-48 max-w-full rounded" />
					<Skeleton className="h-4 w-20 rounded" />
				</div>
			</div>
		</section>
	);
}
