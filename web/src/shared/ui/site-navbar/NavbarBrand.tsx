import { cn } from "cn";
import { AppWindow, ChevronDown, Music } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./NavbarBrand.module.css";

const TINT = "[--brand-tint:color-mix(in_oklab,var(--foreground)_5%,transparent)]";

/**
 * 包住 {@link NavbarBrand} 的可点击元素类名：撑满药丸高度，悬停与展开时叠一层 5% 前景色，
 * 收起态收紧右内边距。药丸外壳（底色、边、阴影）由 `NAVBAR_PILL_CLASS` 提供，二者套在同一元素上；
 * 悬停用叠加的渐变而不是换底色，才不会盖掉药丸自己的半透明底。
 */
export const NAVBAR_BRAND_CLASS = `group flex items-center rounded-full pr-3 pl-1 transition-[padding,background-color] duration-300 hover:bg-[linear-gradient(var(--brand-tint),var(--brand-tint))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-data-[collapsed=true]/navbar:pr-1 data-[state=open]:bg-[linear-gradient(var(--brand-tint),var(--brand-tint))] motion-reduce:transition-none ${TINT}`;

/** 药丸里叠在头像后面的实时状态。 */
export interface NavbarLive {
	/** 封面圆：有歌（正在播放，或暂停未超时）时出现。 */
	cover?: { src?: string | null; paused?: boolean };
	/** 应用图标圆。 */
	app?: { src?: string | null };
	/** 正在播放：显示均衡器。 */
	playing?: boolean;
	/** 药丸里的两行文字；省略时显示站名字标。 */
	lines?: { primary: string; secondary?: string };
}

export interface NavbarBrandProps {
	/** 站名，显示为全大写。 */
	name: string;
	/** 头像地址；省略时显示默认标记。 */
	avatar?: string | null;
	/** 档案面板是否展开：箭头朝上。 */
	open?: boolean;
	/** 实时状态；省略时只有头像与站名。 */
	live?: NavbarLive;
}

const CIRCLE =
	"flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card";
/** 叠在前一枚圆后面，重叠 10px。 */
const STACKED = "-ml-2.5";

/** 封面圆与应用圆：没有图片时同尺寸占位，图片加载前底色与占位一致。 */
function StackCircle({
	slot,
	src,
	fallback,
	className,
}: {
	slot: string;
	src?: string | null;
	fallback: ReactNode;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			data-slot={slot}
			className={cn(CIRCLE, STACKED, "bg-muted text-muted-foreground", className)}
		>
			{src ? <img src={src} alt="" className="size-full object-cover" /> : fallback}
		</span>
	);
}

function Equalizer() {
	return (
		<span
			aria-hidden="true"
			data-slot="brand-equalizer"
			className="flex h-3.25 flex-none items-end gap-0.5"
		>
			<i className={styles.bar} />
			<i className={styles.bar} />
			<i className={styles.bar} />
		</span>
	);
}

/**
 * logo 药丸里的内容：头像、可选的封面圆与应用圆、站名或两行文字、均衡器与箭头。
 *
 * 必须渲染在带 `group` 类的可点击祖先里（悬停变色）。药丸外壳的 `data-collapsed` 为 true 时，
 * 文字、均衡器与箭头折叠，头像与叠圆仍保留。
 */
export function NavbarBrand({ name, avatar, open = false, live }: NavbarBrandProps) {
	const lines = live?.lines;
	return (
		<>
			<span className="flex flex-none items-center">
				<span
					aria-hidden="true"
					data-slot="brand-avatar"
					className={cn(
						CIRCLE,
						"bg-selected text-selected-foreground transition-colors group-hover:bg-selected-hover",
					)}
				>
					{avatar ? (
						<img src={avatar} alt="" className="size-full object-cover" />
					) : (
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="size-4"
						>
							<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
							<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
						</svg>
					)}
				</span>
				{live?.cover ? (
					<StackCircle
						slot="brand-cover"
						src={live.cover.src}
						fallback={<Music aria-hidden="true" className="size-3.5" />}
						className={live.cover.paused ? "grayscale opacity-60" : undefined}
					/>
				) : null}
				{live?.app ? (
					<StackCircle
						slot="brand-app"
						src={live.app.src}
						fallback={<AppWindow aria-hidden="true" className="size-3.5" />}
					/>
				) : null}
			</span>
			<span
				data-slot="brand-label"
				className="flex max-w-96 items-center gap-2 overflow-hidden pl-2 transition-[max-width,padding,opacity] duration-300 ease-out group-data-[collapsed=true]/navbar:max-w-0 group-data-[collapsed=true]/navbar:pl-0 group-data-[collapsed=true]/navbar:opacity-0 motion-reduce:transition-none"
			>
				{lines ? (
					<span data-slot="brand-lines" className="min-w-0 max-w-23">
						<span className="block truncate text-[13px]/[1.3] font-medium text-foreground">
							{lines.primary}
						</span>
						{lines.secondary ? (
							<span className="block truncate text-[11.5px]/[1.3] text-muted-foreground">
								{lines.secondary}
							</span>
						) : null}
					</span>
				) : (
					<span className="truncate font-mono text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors group-hover:text-primary">
						{name}
					</span>
				)}
				{live?.playing ? <Equalizer /> : null}
				<ChevronDown
					aria-hidden="true"
					data-slot="brand-chevron"
					className={cn(
						"size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
						open && "rotate-180 text-foreground",
					)}
				/>
			</span>
		</>
	);
}
