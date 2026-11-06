import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** 包住 {@link NavbarBrand} 的可点击元素类名：药丸内撑满高度，悬停与展开时的底色，收起态收紧右内边距。 */
export const NAVBAR_BRAND_CLASS =
	"group flex h-full items-center rounded-full pr-3 pl-1 transition-[padding,background-color] duration-300 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-data-[collapsed=true]/navbar:pr-1 data-[state=open]:bg-foreground/5 motion-reduce:transition-none";
export interface NavbarBrandProps {
	/** 站名，显示为全大写。 */
	name: string;
	/** 头像地址；省略时显示默认标记。 */
	avatar?: string | null;
	/** 站名右侧的附加内容（如此刻状态），随收起一起折叠。 */
	trailing?: ReactNode;
	/** 站名的附加类名，如在有附加内容的宽度下隐藏站名。 */
	nameClassName?: string;
	/** 档案面板是否展开：箭头朝上。 */
	open?: boolean;
}

/**
 * logo 药丸里的内容：头像、站名与箭头。
 *
 * 必须渲染在带 `group` 类的可点击祖先里（悬停变色），药丸外壳的 `data-collapsed`
 * 为 true 时站名、附加内容与箭头折叠，只留头像。
 */
export function NavbarBrand({
	name,
	avatar,
	trailing,
	nameClassName,
	open = false,
}: NavbarBrandProps) {
	return (
		<>
			<span
				aria-hidden="true"
				className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-selected text-selected-foreground transition-colors group-hover:bg-selected-hover"
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
			<span className="flex max-w-96 items-center gap-2 overflow-hidden pl-2 transition-[max-width,padding,opacity] duration-300 ease-out group-data-[collapsed=true]/navbar:max-w-0 group-data-[collapsed=true]/navbar:pl-0 group-data-[collapsed=true]/navbar:opacity-0 motion-reduce:transition-none">
				<span
					className={cn(
						"truncate font-mono text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors group-hover:text-primary",
						nameClassName,
					)}
				>
					{name}
				</span>
				{trailing}
				<ChevronDown
					aria-hidden="true"
					className={cn(
						"size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
						open && "rotate-180 text-foreground",
					)}
				/>
			</span>
		</>
	);
}
