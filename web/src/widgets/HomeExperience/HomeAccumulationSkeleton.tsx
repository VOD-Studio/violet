import { Skeleton } from "@violet/ui";

const MONTH_TICK_COUNT = 11;
const PLACEHOLDER_NODES = [18, 41, 57, 79] as const;

/** 首页积微成著时间线骨架：标题为静态文案直接呈现，轴线只表达月度结构，不预设季节与发布数据。 */
export function HomeAccumulationSkeleton() {
	return (
		<section
			aria-busy="true"
			aria-labelledby="home-accumulation-title"
			className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
		>
			<div className="mx-auto max-w-6xl">
				<h2
					id="home-accumulation-title"
					className="text-center text-2xl font-normal tracking-[0.08em] text-foreground/90 sm:text-3xl"
				>
					积微成著
				</h2>

				<figure className="mt-10 sm:mt-12">
					<div aria-hidden className="relative h-20">
						<div className="absolute inset-x-0 top-8 h-px bg-border/70">
							{Array.from({ length: MONTH_TICK_COUNT }, (_, index) => (
								<span
									key={index}
									style={{
										left: `${((index + 1) / (MONTH_TICK_COUNT + 1)) * 100}%`,
									}}
									className="absolute top-0 h-1.5 w-px -translate-y-1/2 bg-border"
								/>
							))}
							{PLACEHOLDER_NODES.map((position, index) => (
								<span
									key={position}
									style={{
										left: `${position}%`,
										animationDelay: `${index * 240}ms`,
									}}
									className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/30 motion-safe:animate-pulse"
								/>
							))}
						</div>
					</div>

					<div className="mt-12 flex flex-col items-center gap-3.5 sm:mt-14">
						<Skeleton className="h-4 w-64 max-w-full rounded" />
						<Skeleton className="h-3.5 w-40 max-w-full rounded" />
					</div>
				</figure>
			</div>
		</section>
	);
}
