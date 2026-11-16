import { MorphingPopover, MorphingPopoverContent, MorphingPopoverTrigger } from "@violet/ui";
import { cn } from "cn";
import { useState } from "react";
import {
	NAVBAR_BRAND_CLASS,
	NAVBAR_PILL_CLASS,
	NavbarBrand,
	type NavbarBrandProps,
	type NavbarLinkComponent,
} from "../site-navbar";
import { ProfileCard, type ProfileCardProps } from "./ProfileCard";

/** 品牌触发器与站长卡片的组合契约，开合可由宿主控制。 */
export interface SiteProfileProps {
	brand: Omit<NavbarBrandProps, "open">;
	/** 药丸（触发器）的名称，如「Violet 站长档案，此刻正在播放 晴天」。 */
	label: string;
	card: Omit<ProfileCardProps, "onNavigate" | "LinkComponent">;
	/** 受控开合；省略则内部管理。 */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	LinkComponent?: NavbarLinkComponent;
}

/**
 * 由品牌药丸形变展开的站长卡片。
 *
 * @remarks 触发器自带 {@link NAVBAR_PILL_CLASS} 外壳，须放入 SiteNavbar 的 logo 槽，
 * 由左容器提供定位参照与展开层级。
 */
export function SiteProfile({
	brand,
	label,
	card,
	open: openProp,
	onOpenChange,
	LinkComponent,
}: SiteProfileProps) {
	const [innerOpen, setInnerOpen] = useState(false);
	const open = openProp ?? innerOpen;
	const setOpen = (next: boolean) => {
		setInnerOpen(next);
		onOpenChange?.(next);
	};

	return (
		<MorphingPopover open={open} onOpenChange={setOpen}>
			<MorphingPopoverTrigger
				aria-label={label}
				className={cn(NAVBAR_PILL_CLASS, NAVBAR_BRAND_CLASS)}
			>
				<NavbarBrand {...brand} avatarName={card.identity.name} open={open} />
			</MorphingPopoverTrigger>
			<MorphingPopoverContent
				aria-label="站长与此刻"
				className="w-96 max-w-[calc(100vw-1.5rem)]"
				radius={16}
				ghost={
					// 与触发器同样的边框与内边距，让副本的内容落在触发器上字的原位
					<span className="flex size-full items-center border border-transparent pr-3 pl-1 group-data-[collapsed=true]/navbar:pr-1">
						<NavbarBrand {...brand} avatarName={card.identity.name} />
					</span>
				}
			>
				<ProfileCard
					{...card}
					onNavigate={() => setOpen(false)}
					LinkComponent={LinkComponent}
				/>
			</MorphingPopoverContent>
		</MorphingPopover>
	);
}
