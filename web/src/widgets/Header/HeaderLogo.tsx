import { useActivePersona } from "@entities/persona/api/queries";
import { useSiteIdentity } from "@entities/site-identity/api/queries";
import {
	navbarLive,
	PresenceProfileProgress,
	profileLabel,
	profileNow,
	useLivePresence,
} from "@features/presence";
import { avatarUrl } from "@shared/lib/image-url";
import { yearProgress } from "@shared/lib/year-progress";
import { type ProfileCardProps, SiteProfile } from "@shared/ui/site-profile";
import { useMemo, useState } from "react";
import { useProfileLatest } from "./profile-latest";

/** 站点品牌入口：药丸里是站长此刻，点开长成站长卡片。 */
const HeaderLogo = () => {
	const { data: identity } = useSiteIdentity();
	const { data: persona } = useActivePersona();
	const { lead, clockOffset } = useLivePresence();
	const [open, setOpen] = useState(false);
	// 悬停、聚焦或按下药丸时就开始取最新文章与手记，点开时数据多半已到
	const [intent, setIntent] = useState(false);
	const { latest, pending } = useProfileLatest(intent || open);

	const siteName = identity?.site_name ?? "Violet";
	const ownerName = identity?.owner_name ?? siteName;
	const avatarSource = persona?.avatar.url.trim() || identity?.avatar_url;
	const avatar = avatarSource ? avatarUrl(avatarSource, ownerName) : undefined;

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
			bio: identity?.bio || undefined,
			avatar,
			githubHref: identity?.social_links.find((link) => link.kind === "github")?.href,
			rssHref: identity?.subscription_channels.find((link) => link.kind === "rss")?.href,
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
