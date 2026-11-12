import { Link } from "@tanstack/react-router";
import { iconProps } from "@violet/ui";
import { ArrowUpRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/** 页脚站内链接的渲染契约；展品里注入只阻止跳转的实现。 */
export interface SiteFooterLinkProps {
	href: string;
	className?: string;
	children?: ReactNode;
}

/** 默认站内链接：交给 TanStack Router 做客户端跳转。 */
function RouterLink({ href, className, children }: SiteFooterLinkProps) {
	return (
		<Link to={href} className={className}>
			{children}
		</Link>
	);
}

/** 页脚站内链接分组；外链（RSS、GitHub）由 props 决定是否出现。 */
const SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
	{
		title: "关于",
		links: [
			{ label: "关于本站", href: "/about" },
			{ label: "友链来往", href: "/friends" },
			{ label: "开源项目", href: "/projects" },
		],
	},
	{
		title: "著述",
		links: [
			{ label: "文心长墨", href: "/blog" },
			{ label: "求索札记", href: "/notes" },
			{ label: "长卷连载", href: "/series" },
			{ label: "光影撷影", href: "/galleries" },
		],
	},
];

const LINK_CLASS = "transition-colors hover:text-foreground";

export interface SiteFooterProps {
	/** 左上角品牌名，同时是回首页的链接 */
	siteName: string;
	/** 品牌名下的格言 */
	tagline: string;
	/** 版权行里的年份；由调用方给出，展示层不读时钟 */
	year: number;
	/** 底行左侧的站点域名；省略则不显示 */
	domain?: string;
	/** 底行右侧版权文案；省略时为「© 年份 站名. All rights reserved.」 */
	copyright?: string;
	/** 「RSS 订阅」的地址；省略则不显示该项 */
	rssHref?: string;
	/** 「GitHub」外链地址；省略则不显示该项 */
	githubHref?: string;
	/** 季节挂件，渲染在着色主体的上沿；展示层不依赖 features，由接线层注入 */
	ornament?: ReactNode;
	/** 站内链接的渲染组件，默认走路由跳转 */
	LinkComponent?: ComponentType<SiteFooterLinkProps>;
}

/**
 * 站点页脚：上沿 64px 渐入条接着季节着色的主体，左品牌右三组导航，底行域名与版权。
 * 版式按自身容器宽度响应，窄容器里导航落到品牌下方。
 *
 * @param props - 见 {@link SiteFooterProps}
 * @example
 * <SiteFooter siteName="Violet" tagline="一花一叶，皆成文章。" year={2026} />
 */
export function SiteFooter({
	siteName,
	tagline,
	year,
	domain,
	copyright,
	rssHref,
	githubHref,
	ornament,
	LinkComponent = RouterLink,
}: SiteFooterProps) {
	return (
		<footer className="@container text-foreground relative z-1 w-full pt-16">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--decoration)_7%,var(--background)))]"
			/>
			<div className="relative bg-[color-mix(in_oklab,var(--decoration)_7%,var(--background))] pt-8 pb-4">
				{ornament}
				<div className="mx-auto max-w-296 px-5 @3xl:px-8">
					<div className="flex flex-col gap-10 @3xl:flex-row @3xl:justify-between @3xl:gap-16">
						<div className="flex max-w-sm flex-col gap-3">
							<LinkComponent
								href="/"
								className="font-mono text-2xl/[1.3] font-bold tracking-wide transition-colors hover:text-primary"
							>
								{siteName}
							</LinkComponent>
							<p className="font-quote text-foreground/85 text-xs/[1.7] italic">
								{tagline}
							</p>
							<p className="text-muted-foreground font-mono text-xs tabular-nums">
								© {year} Powered by Violet.
							</p>
							<div
								role="status"
								className="text-muted-foreground flex items-center gap-2 pt-1 text-[11px]"
							>
								<span
									aria-hidden="true"
									className="bg-success size-1.5 rounded-full ring-3 ring-success/20"
								/>
								站点安静运行中
							</div>
						</div>
						<nav
							aria-label="页脚导航"
							className="grid grid-cols-[repeat(3,max-content)] gap-x-6 @md:gap-x-10 @3xl:gap-x-16"
						>
							{SECTIONS.map((section) => (
								<div key={section.title}>
									<h3 className="text-foreground text-xs font-semibold tracking-[.06em]">
										{section.title}
									</h3>
									<ul className="text-foreground/75 mt-3 flex flex-col gap-2.5 text-xs">
										{section.links.map((link) => (
											<li key={link.href}>
												<LinkComponent
													href={link.href}
													className={LINK_CLASS}
												>
													{link.label}
												</LinkComponent>
											</li>
										))}
									</ul>
								</div>
							))}
							<div>
								<h3 className="text-foreground text-xs font-semibold tracking-[.06em]">
									连接
								</h3>
								<ul className="text-foreground/75 mt-3 flex flex-col gap-2.5 text-xs">
									<li>
										<LinkComponent href="/tweets" className={LINK_CLASS}>
											推文微动态
										</LinkComponent>
									</li>
									{rssHref ? (
										<li>
											<a href={rssHref} className={LINK_CLASS}>
												RSS 订阅
											</a>
										</li>
									) : null}
									{githubHref ? (
										<li>
											<a
												href={githubHref}
												target="_blank"
												rel="noopener noreferrer"
												className={`${LINK_CLASS} inline-flex items-center gap-0.5`}
											>
												GitHub
												<ArrowUpRight
													aria-hidden="true"
													{...iconProps(12, "opacity-60")}
												/>
											</a>
										</li>
									) : null}
								</ul>
							</div>
						</nav>
					</div>
					<div className="text-muted-foreground mt-4 flex flex-col gap-1 font-mono text-xs @md:flex-row @md:items-center @md:gap-3">
						{domain ? <span>{domain}</span> : null}
						<p className="tabular-nums @md:ml-auto">
							{copyright ?? `© ${year} ${siteName}. All rights reserved.`}
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
