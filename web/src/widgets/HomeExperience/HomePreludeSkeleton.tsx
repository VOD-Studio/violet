import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页个人序章专属骨架屏。 */
export function HomePreludeSkeleton() {
	return (
		<section
			aria-label="正在加载个人简介"
			className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-18"
		>
			<div className="grid items-center gap-14 lg:min-h-96 lg:grid-cols-2 lg:gap-24">
				<div className="max-w-xl">
					<Skeleton className="h-11 w-64 rounded-xl sm:h-14 sm:w-80 lg:h-16 lg:w-96" />
					<Skeleton className="mt-4 h-6 w-36 rounded-lg" />
					<div className="mt-6 space-y-2">
						<Skeleton className="h-4.5 w-full max-w-md rounded" />
						<Skeleton className="h-4.5 w-4/5 max-w-sm rounded" />
					</div>

					<div className="mt-9 flex flex-wrap gap-3">
						<Skeleton className="h-9 w-24 rounded-full border border-border/50" />
						<Skeleton className="h-9 w-28 rounded-full border border-border/50" />
						<Skeleton className="h-9 w-24 rounded-full border border-border/50" />
					</div>
				</div>

				<div className="flex justify-center lg:justify-end">
					<Skeleton className="size-44 rounded-full border border-border/40 sm:size-52 lg:size-64" />
				</div>
			</div>

			<div className="mt-14 flex items-center justify-between border-t border-border/40 pt-6">
				<Skeleton className="h-4 w-72 rounded" />
				<Skeleton className="h-4 w-20 rounded" />
			</div>
		</section>
	);
}
