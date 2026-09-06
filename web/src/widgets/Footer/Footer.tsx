import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();
	const rawName = data?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const bio = data?.tagline?.trim() || "Stay hungry. Stay foolish.";
	const rawDomain = data?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "");
	const displayDomain =
		rawDomain && !rawDomain.includes("localhost") && !rawDomain.includes("127.0.0.1")
			? rawDomain
			: "";
	const footerText =
		data?.footer_text?.trim()?.replace(/My Blog/g, "Violet") ||
		`© ${year} ${siteName}. All rights reserved.`;

	return (
		<footer className="relative z-1 pb-12 pt-8 bg-background text-foreground">
			<div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
				{/* 主内容双栏：左侧品牌与格言，右侧三列导航 */}
				<div className="flex flex-col justify-between gap-12 md:flex-row md:gap-16">
					{/* 左侧品牌区 */}
					<div className="max-w-sm space-y-3">
						<div className="text-xl font-semibold tracking-wide text-foreground sm:text-2xl">
							<Link
								to="/"
								className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
							>
								{siteName}
							</Link>
						</div>
						<p className="text-xs italic leading-relaxed text-muted-foreground/80 font-serif">
							{bio}
						</p>
						<p className="text-[11px] leading-normal text-muted-foreground/60 tabular-nums">
							© {year} Powered by Violet.
						</p>
						<div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground/75">
							<span className="relative flex size-2 items-center justify-center">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/50 opacity-75" />
								<span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
							</span>
							<span>站点安静运行中</span>
						</div>
					</div>

					{/* 右侧三列分组导航 */}
					<div className="grid grid-cols-3 gap-8 sm:gap-12 md:gap-16 text-xs">
						{/* 专栏 1：关于 */}
						<div className="space-y-3">
							<p className="font-medium text-foreground/90">关于</p>
							<ul className="space-y-2 text-muted-foreground/75">
								<li>
									<Link
										to="/about"
										className="transition-colors hover:text-foreground"
									>
										关于本站
									</Link>
								</li>
								<li>
									<Link
										to="/friends"
										className="transition-colors hover:text-foreground"
									>
										友链来往
									</Link>
								</li>
								<li>
									<Link
										to="/projects"
										className="transition-colors hover:text-foreground"
									>
										开源项目
									</Link>
								</li>
							</ul>
						</div>

						{/* 专栏 2：创作 */}
						<div className="space-y-3">
							<p className="font-medium text-foreground/90">创作</p>
							<ul className="space-y-2 text-muted-foreground/75">
								<li>
									<Link
										to="/blog"
										className="transition-colors hover:text-foreground"
									>
										深度文章
									</Link>
								</li>
								<li>
									<Link
										to="/notes"
										className="transition-colors hover:text-foreground"
									>
										战地笔记
									</Link>
								</li>
								<li>
									<Link
										to="/series"
										className="transition-colors hover:text-foreground"
									>
										专栏系列
									</Link>
								</li>
								<li>
									<Link
										to="/galleries"
										className="transition-colors hover:text-foreground"
									>
										视觉图集
									</Link>
								</li>
							</ul>
						</div>

						{/* 专栏 3：连接 */}
						<div className="space-y-3">
							<p className="font-medium text-foreground/90">连接</p>
							<ul className="space-y-2 text-muted-foreground/75">
								<li>
									<Link
										to="/tweets"
										className="transition-colors hover:text-foreground"
									>
										推文微动态
									</Link>
								</li>
								{data?.social_rss ? (
									<li>
										<a
											href={data.social_rss}
											className="transition-colors hover:text-foreground"
										>
											RSS 订阅
										</a>
									</li>
								) : null}
								{data?.github_username ? (
									<li>
										<a
											href={`https://github.com/${data.github_username}`}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
										>
											GitHub
											<ArrowUpRight className="size-3 text-muted-foreground/40" />
										</a>
									</li>
								) : null}
							</ul>
						</div>
					</div>
				</div>

				{/* 底部极细行 */}
				<div className="mt-12 flex flex-col justify-between gap-3 border-t border-border/20 pt-6 text-[11px] text-muted-foreground/60 sm:flex-row sm:items-center">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						{data?.social_rss ? (
							<a
								href={data.social_rss}
								className="transition-colors hover:text-foreground"
							>
								RSS 订阅
							</a>
						) : null}
						{displayDomain ? (
							<>
								<span aria-hidden>·</span>
								<span className="font-mono">{displayDomain}</span>
							</>
						) : null}
					</div>
					<p className="tabular-nums">{footerText}</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
