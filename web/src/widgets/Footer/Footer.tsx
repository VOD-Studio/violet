import { useSettings } from "@features/settings/api/queries";

/**
 * Footer - 页脚（Nexus 视觉）
 *
 * 极细 1px 顶边 + 字体改 mono + 社交链接。
 * 数据走 useSettings（SSR 预取），不动 api。
 */
const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-edge-hairline">
			<div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
				<p className="font-mono text-xs text-muted-foreground">
					© {year} {data?.siteName ?? "Nexus-Blog"} · built with obsession
				</p>
				{data?.socials ? (
					<div className="flex gap-5 font-mono text-xs text-muted-foreground">
						{data.socials.github ? (
							<a
								className="transition-colors hover:text-neon-blue"
								href={data.socials.github}
							>
								GitHub
							</a>
						) : null}
						{data.socials.twitter ? (
							<a
								className="transition-colors hover:text-neon-blue"
								href={data.socials.twitter}
							>
								Twitter
							</a>
						) : null}
						{data.socials.email ? (
							<a
								className="transition-colors hover:text-neon-blue"
								href={`mailto:${data.socials.email}`}
							>
								Email
							</a>
						) : null}
					</div>
				) : null}
			</div>
		</footer>
	);
};

export default Footer;
