import { useActivePersona } from "@entities/persona/api/queries";
import {
	describeActivity,
	deviceActivities,
	PresenceCard,
	PresenceTicker,
	useLivePresence,
} from "@features/presence";
import { useSettings } from "@features/settings/api/queries";
import { NAVBAR_BRAND_CLASS, NavbarBrand } from "@shared/ui/site-navbar";
import { Dropdown, DropdownContent, DropdownTrigger } from "@violet/ui";
import { useState } from "react";
import { HeaderContributionCard } from "./HeaderContributionCard";

/** 站点品牌入口与悬停档案面板。 */
const HeaderLogo = () => {
	const { data: settings } = useSettings();
	const { data: persona } = useActivePersona();
	const [open, setOpen] = useState(false);
	const rawName = settings?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const personaAvatar = persona?.avatar.thumbnail || persona?.avatar.url;
	const { devices, lead, clockOffset } = useLivePresence();
	const [activity] = lead ? deviceActivities(lead) : [];
	const label = activity
		? `${siteName} 站长档案，此刻${describeActivity(activity)}`
		: `${siteName} 站长开源档案与简介`;

	return (
		<Dropdown open={open} onOpenChange={setOpen}>
			<DropdownTrigger asChild>
				<button type="button" aria-label={label} className={NAVBAR_BRAND_CLASS}>
					<NavbarBrand
						name={siteName}
						avatar={personaAvatar}
						open={open}
						nameClassName={activity ? "lg:hidden" : undefined}
						trailing={
							lead && activity ? (
								// 桌面顶栏用 Logo 胶囊承载此刻状态；移动端由底部岛展示
								<PresenceTicker
									device={lead}
									clockOffset={clockOffset}
									secondaryClassName="hidden xl:inline"
									className="hidden text-xs text-foreground lg:inline-flex"
								/>
							) : null
						}
					/>
				</button>
			</DropdownTrigger>

			<DropdownContent
				role="region"
				aria-label="站长开源档案与简介"
				align="start"
				className="pointer-events-auto w-121 max-w-[calc(100vw-1rem)] bg-popover/95 p-4 backdrop-blur-xl"
			>
				{lead ? (
					<PresenceCard
						devices={devices}
						lead={lead}
						clockOffset={clockOffset}
						className="mb-4 hidden border-b border-border/60 pb-4 lg:block"
					/>
				) : null}
				<HeaderContributionCard
					persona={persona ?? undefined}
					onNavigate={() => setOpen(false)}
				/>
			</DropdownContent>
		</Dropdown>
	);
};

export default HeaderLogo;
