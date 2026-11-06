import { useActivePersona } from "@entities/persona/api/queries";
import {
	navbarLive,
	PresenceProfileProgress,
	profileLabel,
	profileNow,
	useLivePresence,
} from "@features/presence";
import { useSettings } from "@features/settings/api/queries";
import { avatarUrl } from "@shared/lib/image-url";
import { yearProgress } from "@shared/lib/year-progress";
import { type ProfileCardProps, SiteProfile } from "@shared/ui/site-profile";
import { useMemo, useState } from "react";
import { useProfileLatest } from "./profile-latest";

/** 站点品牌入口：药丸里是站长此刻，点开长成站长卡片。 */
const HeaderLogo = () => {
	const { data: settings } = useSettings();
	const { data: persona } = useActivePersona();
	const { lead, clockOffset } = useLivePresence();
	const [open, setOpen] = useState(false);
	// 悬停、聚焦或按下药丸时就开始取最新文章与手记，点开时数据多半已到
	const [intent, setIntent] = useState(false);
	const { latest, pending } = useProfileLatest(intent || open);

	const rawName = settings?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const githubUsername = settings?.github_username?.trim() || "";
	const ownerName = githubUsername || siteName;
	const personaAvatar = persona?.avatar.thumbnail || persona?.avatar.url;
	const configuredAvatar = settings?.avatar_url?.trim();
	const githubAvatar = githubUsername
		? `https://github.com/${encodeURIComponent(githubUsername)}.png?size=96`
		: "";
	const avatar =
		personaAvatar || (configuredAvatar ? avatarUrl(configuredAvatar, ownerName) : githubAvatar);

	const label = profileLabel(siteName, lead);

	const now = useMemo(() => {
		const view = profileNow(lead);
		const media = lead?.sources.media;
		if (!(view?.media && lead && media)) return view;
		return {
			...view,
			media: {
				...view.media,
				progress: (
					<PresenceProfileProgress
						media={media}
						device={lead}
						clockOffset={clockOffset}
					/>
				),
			},
		};
	}, [lead, clockOffset]);

	const card: Omit<ProfileCardProps, "onNavigate" | "LinkComponent"> = {
		identity: {
			name: ownerName,
			bio: settings?.bio?.trim() || settings?.tagline?.trim() || undefined,
			avatar,
			githubHref: githubUsername
				? `https://github.com/${encodeURIComponent(githubUsername)}`
				: undefined,
			rssHref: settings?.social_rss || "/feed.xml",
		},
		now,
		latest,
		latestPending: pending,
		year: yearProgress(new Date()),
	};

	return (
		// 只借冒泡监听意图，不参与布局
		<span
			className="contents"
			onPointerEnter={() => setIntent(true)}
			onFocus={() => setIntent(true)}
			onPointerDown={() => setIntent(true)}
		>
			<SiteProfile
				brand={{ name: siteName, avatar, live: navbarLive(lead) }}
				label={label}
				card={card}
				open={open}
				onOpenChange={setOpen}
			/>
		</span>
	);
};

export default HeaderLogo;
