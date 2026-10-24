import { useActivePersona } from "@entities/persona/api/queries";
import { useSettings } from "@features/settings/api/queries";
import { CapsuleOrnament } from "@features/theme-seasons-prototype/decorations";
import { Dropdown, DropdownContent, DropdownTrigger } from "@violet/ui";

import { cn } from "cn";
import { ChevronDown } from "lucide-react";
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

	return (
		<Dropdown open={open} onOpenChange={setOpen}>
			<DropdownTrigger asChild>
				<button
					type="button"
					aria-label={`${siteName} 站长开源档案与简介`}
					className="dialect-public group pointer-events-auto relative flex h-10 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 backdrop-blur-md transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-border data-[state=open]:bg-muted/50 dark:bg-card/85"
				>
					{/* PROTOTYPE（#645）：挂件 */}
					<CapsuleOrnament variant={0} />
					<span
						aria-hidden="true"
						className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-selected text-selected-foreground ring-1 ring-border/50 transition-colors group-hover:bg-selected-hover"
					>
						{personaAvatar ? (
							<img src={personaAvatar} alt="" className="size-full object-cover" />
						) : (
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-3"
							>
								<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
								<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
							</svg>
						)}
					</span>
					<span className="truncate font-mono text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors group-hover:text-primary">
						{siteName}
					</span>
					<ChevronDown
						aria-hidden="true"
						className={cn(
							"size-3 text-muted-foreground/60 transition-transform duration-200 group-hover:text-foreground",
							open && "rotate-180 text-foreground",
						)}
					/>
				</button>
			</DropdownTrigger>

			<DropdownContent
				role="region"
				aria-label="站长开源档案与简介"
				align="start"
				sideOffset={10}
				className="dialect-public pointer-events-auto w-121 max-w-[calc(100vw-1rem)] border-border/80 bg-popover/95 p-4 backdrop-blur-xl"
			>
				<HeaderContributionCard
					persona={persona ?? undefined}
					onNavigate={() => setOpen(false)}
				/>
			</DropdownContent>
		</Dropdown>
	);
};

export default HeaderLogo;
