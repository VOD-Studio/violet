import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";

/**
 * HeaderLogo - 悬浮品牌 Logo 胶囊
 *
 * 对齐三段式悬浮胶囊设计，点击回首页。
 * 严禁 scale 变形，纯色/边框过渡。
 */
const HeaderLogo = () => {
	const { data } = useSettings();
	const rawName = data?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;

	return (
		<Link
			to="/"
			aria-label={`返回 ${siteName} 首页`}
			className="group pointer-events-auto flex h-10 items-center gap-2.5 rounded-full border border-border/60 bg-background/80 px-3.5 shadow-xs backdrop-blur-md transition-colors hover:border-border hover:bg-muted/40 dark:bg-card/85"
		>
			{/* 品牌专属微标：极简几何花瓣晶体 */}
			<span
				aria-hidden="true"
				className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="size-3"
				>
					<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
					<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
				</svg>
			</span>
			<span className="truncate font-mono text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-primary">
				{siteName}
			</span>
		</Link>
	);
};

export default HeaderLogo;
