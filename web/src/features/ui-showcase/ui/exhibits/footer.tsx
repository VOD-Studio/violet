import { SiteFooter } from "@shared/ui/site-footer";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { StayLink } from "./stay-link";

function FooterSample({ state }: ExhibitRenderProps) {
	return (
		<div className={state === "narrow" ? "w-97.5" : "w-280"}>
			<SiteFooter
				siteName="Violet"
				tagline="一花一叶，皆成文章。"
				year={2026}
				domain="xunrua.top"
				rssHref="#rss"
				githubHref="#github"
				LinkComponent={StayLink}
			/>
		</div>
	);
}

export const footerExhibit: Exhibit = {
	id: "footer",
	name: "页脚",
	units: ["footer"],
	zone: "banner",
	category: "layout",
	footprint: { width: 1120, height: 460 },
	states: [
		{ id: "desktop", label: "桌面" },
		{ id: "narrow", label: "窄屏" },
	],
	Render: FooterSample,
};
