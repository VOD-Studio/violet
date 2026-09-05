import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();
	const siteName = data?.site_name?.trim() || "Violet";
	const domain = data?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "xunrua.top";

	return (
		<footer className="border-t border-border bg-background text-foreground">
			<div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
				<div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
					<Link
						to="/"
						className="flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
					>
						<span
							aria-hidden
							className="flex size-9 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background"
						>
							V
						</span>
						<span className="text-sm font-semibold">{siteName}</span>
					</Link>
					<nav aria-label="页脚导航" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
						<Link className="footer-link" to="/blog">
							文章
						</Link>
						<Link className="footer-link" to="/notes">
							笔记
						</Link>
						<Link className="footer-link" to="/friends">
							友链
						</Link>
						<Link className="footer-link" to="/about">
							关于
						</Link>
					</nav>
				</div>
				<div className="mt-7 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
					<p>{data?.footer_text?.trim() || `© ${year} ${siteName}`}</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
						<span>{domain}</span>
						{data?.social_rss ? (
							<a className="footer-link" href={data.social_rss}>
								RSS
							</a>
						) : null}
						{data?.github_username ? (
							<a
								className="footer-link"
								href={`https://github.com/${data.github_username}`}
								target="_blank"
								rel="noreferrer"
							>
								GitHub
								<ArrowUpRight className="size-3" />
							</a>
						) : null}
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
