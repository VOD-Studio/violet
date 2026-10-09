import { cn } from "cn";
import type { ReactNode } from "react";

export interface UserProfileLayoutProps {
	/** 左侧资料栏。 */
	panel: ReactNode;
	/** 中间的主内容。 */
	main: ReactNode;
	/** 右侧概览栏；为空时收起这一栏，主内容占满剩余宽度。 */
	rail?: ReactNode;
}

/**
 * 公开用户页的版心：顶部淡色封面，下方三栏（资料 / 内容 / 概览）。
 *
 * 宽屏三栏并排；中等宽度概览栏落到资料栏下方；窄屏依次堆叠。资料栏头像压在封面下缘。
 * 封面目前是主题色渐变，以后接入用户自定义封面时只替换这一层。
 */
export function UserProfileLayout({ panel, main, rail }: UserProfileLayoutProps) {
	return (
		<div className="mx-auto w-full max-w-7xl">
			<div
				aria-hidden="true"
				className="h-32 rounded-2xl bg-linear-to-br from-primary/30 via-primary/15 to-accent sm:h-40"
			/>
			<div
				className={cn(
					"grid gap-x-8 gap-y-8 px-1 pb-8 lg:grid-cols-[17rem_minmax(0,1fr)]",
					rail && "xl:grid-cols-[17rem_minmax(0,1fr)_16rem]",
				)}
			>
				<aside className="-mt-14 lg:col-start-1 lg:row-start-1">{panel}</aside>
				<main className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
					{main}
				</main>
				{rail && (
					<div className="lg:col-start-1 lg:row-start-2 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:pt-6">
						{rail}
					</div>
				)}
			</div>
		</div>
	);
}
