import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页探索导航专属骨架屏。 */
export function HomeClosingSkeleton() {
	return (
		<section
			aria-label="正在加载站点导航"
			className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-12 lg:py-36"
		>
			<div className="flex flex-col items-center text-center">
				<Skeleton className="h-7 w-32 rounded-lg" />
				<Skeleton className="mt-4 h-4 w-72 rounded" />

				<div className="mt-14 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-6 sm:gap-x-10">
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} className="h-5 w-20 rounded-md" />
					))}
				</div>
			</div>
		</section>
	);
}
