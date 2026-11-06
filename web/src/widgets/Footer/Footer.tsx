import { FooterOrnament } from "@features/seasonal-decor/ui/ornaments";
import { useSettings } from "@features/settings/api/queries";
import { SiteFooter } from "@shared/ui/site-footer";

const Footer = () => {
	const { data } = useSettings();
	const year = new Date().getFullYear();
	const rawName = data?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const rawDomain = data?.site_url?.replace(/^https?:\/\//, "").replace(/\/$/, "");
	const domain =
		rawDomain && !rawDomain.includes("localhost") && !rawDomain.includes("127.0.0.1")
			? rawDomain
			: undefined;

	return (
		<SiteFooter
			siteName={siteName}
			tagline={data?.tagline?.trim() || "一花一叶，皆成文章。"}
			year={year}
			domain={domain}
			copyright={data?.footer_text?.trim()?.replace(/My Blog/g, "Violet") || undefined}
			rssHref={data?.social_rss || undefined}
			githubHref={
				data?.github_username ? `https://github.com/${data.github_username}` : undefined
			}
			ornament={<FooterOrnament />}
		/>
	);
};

export default Footer;
