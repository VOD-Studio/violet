import type { Season } from "@shared/lib/theme-preference";
import { cn } from "cn";
import { Pipette } from "lucide-react";

/** 主题的品牌实色圆点；`data-theme` 让圆点按该主题重新求值语义色。 */
export function ThemeSwatch({
	theme,
	className,
}: {
	theme: Season | "custom";
	className?: string;
}) {
	return (
		<span
			aria-hidden
			data-theme={theme}
			className={cn(
				"inline-block shrink-0 rounded-full bg-decoration ring-1 ring-edge-hairline ring-inset",
				className,
			)}
		/>
	);
}

/** 自定义选项的圆点：已生效时显示自定义主题的实色，否则显示取色图标。 */
export function CustomThemeSwatch({ active, className }: { active: boolean; className?: string }) {
	if (active) return <ThemeSwatch theme="custom" className={className} />;
	return (
		<span
			aria-hidden
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border ring-inset",
				className,
			)}
		>
			<Pipette className="size-3/5" />
		</span>
	);
}
