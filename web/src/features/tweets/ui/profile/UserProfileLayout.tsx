import { cn } from "cn";
import type { ReactNode } from "react";

export interface UserProfileLayoutProps {
	/** 顶部封面。 */
	cover: ReactNode;
	/** 左侧资料栏。 */
	panel: ReactNode;
	/** 中间的主内容。 */
	main: ReactNode;
	/** 右侧概览栏；为空时收起这一栏，主内容占满剩余宽度。 */
	rail?: ReactNode;
}

/**
 * 公开用户页的版心：顶部封面，下方三栏（资料 / 内容 / 概览）。
 *
 * 宽屏三栏并排且两侧栏吸顶，长推文流滚动时资料与概览仍在视野内；中等宽度概览栏落到资料栏下方；窄屏依次堆叠。资料栏头像压在封面下缘。
 * 封面由调用方提供；资料栏是压在封面下缘的卡片。
 */
export function UserProfileLayout({ cover, panel, main, rail }: UserProfileLayoutProps) {
	return (
		<div className="mx-auto w-full max-w-7xl">
			{cover}
			<div
				className={cn(
					"grid gap-x-8 gap-y-8 px-1 pb-8 lg:grid-cols-[17rem_minmax(0,1fr)]",
					rail && "xl:grid-cols-[17rem_minmax(0,1fr)_16rem]",
				)}
			>
				<aside
					className={cn(
						// 压在封面上，封面带定位，资料栏需要自己的层级才不被盖住。
						"relative z-10 -mt-20 lg:col-start-1 lg:row-start-1",
						// 吸顶的元素要跨满整个网格区域才有滚动空间：三栏时资料栏跨两行，两栏时直接在 lg 吸顶。
						rail
							? "xl:sticky xl:top-24 xl:row-span-2 xl:self-start"
							: "lg:sticky lg:top-24 lg:row-span-2 lg:self-start",
					)}
				>
					{panel}
				</aside>
				<main className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
					{main}
				</main>
				{rail && (
					<div className="lg:col-start-1 lg:row-start-2 xl:sticky xl:top-24 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-start xl:pt-6">
						{rail}
					</div>
				)}
			</div>
		</div>
	);
}
