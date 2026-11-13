import { Avatar, iconProps } from "@violet/ui";
import { cn } from "cn";
import { AppWindow, ChevronDown, Music } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./NavbarBrand.module.css";

const TINT = "[--brand-tint:color-mix(in_oklab,var(--foreground)_5%,transparent)]";

/**
 * 品牌触发器的交互类名。
 *
 * @remarks 与 `NAVBAR_PILL_CLASS` 套在同一元素上；收起时缩小右内边距，
 * 悬停与展开使用半透明叠层，保留药丸底色。
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

/** 站名字标与站长头像资料，可附加实时状态。 */
export interface NavbarBrandProps {
	/** 站名，显示为全大写。 */
	name: string;
	/** 头像地址；省略或加载失败时显示姓名首字。 */
	avatar?: string | null;
	/** 头像所属者；与站名字标不同时显式传入。 */
	avatarName?: string;
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
 * 品牌药丸的头像、实时状态与字标内容。
 *
 * @remarks 祖先须提供 `group`；导航外壳的 data-collapsed 为 true 时，
 * 文字、均衡器与箭头折叠，头像与叠圆仍保留。
 */
export function NavbarBrand({
	name,
	avatar,
	avatarName = name,
	open = false,
	live,
}: NavbarBrandProps) {
	const lines = live?.lines;
	return (
		<>
			<span className="flex flex-none items-center">
				<Avatar
					data-slot="brand-avatar"
					src={avatar ?? undefined}
					name={avatarName}
					alt=""
					size={32}
					className="shrink-0 border-2 border-card"
				/>
				{live?.cover ? (
					<StackCircle
						slot="brand-cover"
						src={live.cover.src}
						fallback={<Music aria-hidden="true" {...iconProps(14)} />}
						className={live.cover.paused ? "grayscale opacity-60" : undefined}
					/>
				) : null}
				{live?.app ? (
					<StackCircle
						slot="brand-app"
						src={live.app.src}
						fallback={<AppWindow aria-hidden="true" {...iconProps(14)} />}
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
					{...iconProps(
						12,
						cn(
							"shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
							open && "rotate-180 text-foreground",
						),
					)}
				/>
			</span>
		</>
	);
}
