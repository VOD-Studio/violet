import { useActivePersona } from "@entities/persona/api/queries";
import { useSettings } from "@features/settings/api/queries";
import { cn } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { HeaderContributionCard } from "./HeaderContributionCard";

/**
 * HeaderLogo - 悬浮品牌 Logo 胶囊与开源贡献档案触发器
 *
 * 点击展开站长开源贡献热力图、时光倒计时与个人档案卡片。
 * 严禁 scale 变形，纯色/边框过渡。
 */
const HeaderLogo = () => {
	const { data: settings } = useSettings();
	const { data: persona } = useActivePersona();
	const [open, setOpen] = useState(false);
	const rawName = settings?.site_name?.trim();
	const siteName = !rawName || rawName === "My Blog" || rawName === "Blog" ? "Violet" : rawName;
	const personaAvatar = persona?.avatar.thumbnail || persona?.avatar.url;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`${siteName} 站长开源档案与简介`}
					aria-expanded={open}
					className="group pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 shadow-xs backdrop-blur-md transition-colors hover:border-border hover:bg-muted/40 data-[state=open]:border-border data-[state=open]:bg-muted/50 dark:bg-card/85"
				>
					<span
						aria-hidden="true"
						className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-border/50 transition-colors group-hover:bg-primary/15"
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
			</PopoverTrigger>

			<PopoverContent
				align="start"
				sideOffset={10}
				className="w-auto overflow-hidden rounded-2xl border-border/80 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl"
			>
				<HeaderContributionCard
					persona={persona ?? undefined}
					onNavigate={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
};

export default HeaderLogo;
