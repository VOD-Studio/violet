import { ArrowLeft, ArrowUp } from "lucide-react";
import { useRef } from "react";
import { DemoArticle } from "./DemoArticle";

/**
 * EndingBackBlock - 方向④：文末返回块
 *
 * 不做常驻 chrome：文章读完处放大返回入口，配「回到顶部」次操作。
 * 离场点最明确、零干扰，但中途离开仍然无解——适合与轻量常驻方案组合。
 * 演示区内「回到顶部」真实生效（滚回容器顶部）。
 */
export function EndingBackBlock() {
	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={scrollRef}
			className="relative h-[560px] overflow-y-auto rounded-xl border border-edge-hairline bg-background/60"
		>
			<DemoArticle
				end={
					<div className="mt-14 border-t border-edge-hairline pt-10 text-center">
						<button
							type="button"
							className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-edge-hairline bg-background px-6 py-3 text-sm font-medium transition-colors hover:border-foreground/40"
						>
							<ArrowLeft className="size-4" />
							返回博客
						</button>
						<button
							type="button"
							onClick={() =>
								scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
							}
							className="ml-3 inline-flex cursor-pointer items-center gap-1.5 px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowUp className="size-3.5" />
							回到顶部
						</button>
					</div>
				}
			/>
		</div>
	);
}
