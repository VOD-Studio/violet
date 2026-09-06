import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();
	const siteName = data?.site_name?.trim() || "Violet";
	const rawDomain = data?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "");
	const displayDomain =
		rawDomain && !rawDomain.includes("localhost") && !rawDomain.includes("127.0.0.1")
			? rawDomain
			: "xunrua.top";

	return (
		<footer className="relative bg-background text-foreground">
			<div className="mx-auto max-w-7xl px-5 pt-6 pb-12 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
				<div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
					<Link
						to="/"
						className="group flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
					>
						<span className="size-2 rounded-full bg-primary transition-transform duration-200 group-hover:scale-125" />
						<span className="text-base font-normal tracking-wide text-foreground transition-colors group-hover:text-primary">
							{siteName}
						</span>
					</Link>
					<nav
						aria-label="页脚导航"
						className="flex flex-wrap gap-x-6 gap-y-3 text-xs sm:text-sm"
					>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/blog"
						>
							文章
						</Link>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/notes"
						>
							笔记
						</Link>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/series"
						>
							系列
						</Link>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/galleries"
						>
							图集
						</Link>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/friends"
						>
							友链
						</Link>
						<Link
							className="footer-link text-muted-foreground hover:text-foreground"
							to="/about"
						>
							关于
						</Link>
					</nav>
				</div>
				<div className="mt-8 flex flex-col gap-4 border-t border-border/30 pt-6 text-[11px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
					<p className="tabular-nums">
						{data?.footer_text?.trim() || `© ${year} ${siteName}. All rights reserved.`}
					</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<span className="font-mono text-muted-foreground/60">{displayDomain}</span>
						{data?.social_rss ? (
							<a className="footer-link hover:text-primary" href={data.social_rss}>
								RSS
							</a>
						) : null}
						{data?.github_username ? (
							<a
								className="footer-link inline-flex items-center gap-1 hover:text-primary"
								href={`https://github.com/${data.github_username}`}
								target="_blank"
								rel="noreferrer"
							>
								GitHub
								<ArrowUpRight className="size-3 text-muted-foreground/40" />
							</a>
						) : null}
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
