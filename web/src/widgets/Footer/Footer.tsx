import { useSettings } from "@features/settings/api/queries";

/**
 * Footer - 页脚
 *
 * 显示站名 + 社交链接（从站点配置读，SSR 已预取）。
 * 配置未加载时不渲染社交区，避免闪烁。
 */
const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-border mt-16">
			<div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
				<p className="text-sm text-muted-foreground">
					© {year} {data?.siteName ?? "Blog"}
				</p>
				{data?.socials ? (
					<div className="flex gap-4 text-sm text-muted-foreground">
						{data.socials.github ? (
							<a href={data.socials.github}>GitHub</a>
						) : null}
						{data.socials.twitter ? (
							<a href={data.socials.twitter}>Twitter</a>
						) : null}
						{data.socials.email ? (
							<a href={`mailto:${data.socials.email}`}>Email</a>
						) : null}
					</div>
				) : null}
			</div>
		</footer>
	);
};

export default Footer;
