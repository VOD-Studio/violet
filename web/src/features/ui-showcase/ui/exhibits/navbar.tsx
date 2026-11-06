import { getNavItems, resolveActiveNav } from "@shared/config/nav";
import { SEASONS, type Season } from "@shared/lib/theme-preference";
import { SeasonGlyph } from "@shared/ui/icons";
import { SiteIsland } from "@shared/ui/site-island";
import { NAVBAR_BRAND_CLASS, NavbarBrand, SiteNavbar } from "@shared/ui/site-navbar";
import { BadgeAnchor, Count, Separator } from "@violet/ui";
import { Bell, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { portrait } from "./art";
import { StayLink } from "./stay-link";

const AVATAR = portrait(30);
const ACCOUNT = portrait(200);
const ARTICLE_TITLE = "派早报：荣耀发布 Robot Phone";
/** 手机舞台的宽度，与移动端设计宽度一致。 */
const PHONE_WIDTH = 390;

const ICON_BUTTON =
	"flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

/** 展柜外观作用域里的季节；检视台切换季节时跟着变，自定义主题按秋处理。 */
function useScopeSeason(host: HTMLElement | null): Season {
	const [season, setSeason] = useState<Season>("autumn");
	useEffect(() => {
		if (!host) return;
		const read = () => {
			const theme = host.dataset.theme;
			setSeason(SEASONS.find((item) => item === theme) ?? "autumn");
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(host, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	}, [host]);
	return season;
}

function Logo() {
	return (
		<button type="button" aria-label="Violet 站长档案" className={NAVBAR_BRAND_CLASS}>
			<NavbarBrand name="Violet" avatar={AVATAR} />
		</button>
	);
}

/** 右药丸内容的陈列替身：真实内容由站点顶栏装配，这里只摆出同样的控件。 */
function Actions({ season, member }: { season: Season; member: boolean }) {
	return (
		<div className="flex items-center gap-0.5">
			<button type="button" aria-label="季节与外观" className={ICON_BUTTON}>
				<SeasonGlyph season={season} className="size-4.5 text-decoration" />
			</button>
			<Separator orientation="vertical" className="h-4 bg-rule2" />
			{member ? (
				<>
					<BadgeAnchor badge={<Count value={5} />}>
						<button type="button" aria-label="消息，5 条未读" className={ICON_BUTTON}>
							<Bell className="size-4.25" />
						</button>
					</BadgeAnchor>
					<button type="button" aria-label="用户菜单" className={ICON_BUTTON}>
						<img src={ACCOUNT} alt="" className="size-8 rounded-full object-cover" />
					</button>
				</>
			) : (
				<button type="button" aria-label="登录" className={ICON_BUTTON}>
					<User className="size-4.25" />
				</button>
			)}
		</div>
	);
}

interface DesktopPreset {
	path: string;
	member: boolean;
	title?: string;
	readingProgress?: number;
	routing?: number;
	collapsed?: boolean;
}

const DESKTOP: Record<string, DesktopPreset> = {
	rest: { path: "/blog", member: true },
	detail: { path: "/blog/hello", member: true, title: ARTICLE_TITLE, readingProgress: 36 },
	child: { path: "/projects", member: true },
	scrolled: { path: "/blog", member: true, collapsed: true },
	"scrolled-detail": {
		path: "/blog/hello",
		member: true,
		title: ARTICLE_TITLE,
		readingProgress: 62,
		collapsed: true,
	},
	routing: { path: "/blog", member: true, routing: 62 },
	guest: { path: "/", member: false },
};

/** 页面正文的占位条，让导航悬在一页内容之上而不是空白里。 */
function PageBody({ className }: { className?: string }) {
	return (
		<div aria-hidden="true" className={className}>
			<div className="h-5 w-2/5 rounded-md bg-muted" />
			<div className="mt-4 h-3 w-full rounded-md bg-muted/70" />
			<div className="mt-2.5 h-3 w-11/12 rounded-md bg-muted/70" />
			<div className="mt-2.5 h-3 w-4/5 rounded-md bg-muted/70" />
		</div>
	);
}

function Desktop({ preset }: { preset: DesktopPreset }) {
	const { ref, host } = useStageContainer();
	const season = useScopeSeason(host);
	const items = getNavItems({ authenticated: preset.member });
	return (
		<div ref={ref} className="w-full">
			<SiteNavbar
				items={items}
				active={resolveActiveNav(preset.path, items)}
				title={preset.title ?? null}
				readingProgress={preset.readingProgress}
				routing={preset.routing ?? null}
				collapsed={preset.collapsed}
				logo={<Logo />}
				actions={<Actions season={season} member={preset.member} />}
				onSearch={() => {}}
				centerClassName="block"
				LinkComponent={StayLink}
			/>
			<PageBody className="mt-24 max-w-xl" />
		</div>
	);
}

type Phone = "tabs" | "panel" | "compact";

function Mobile({ initial }: { initial: Phone }) {
	const { ref, host } = useStageContainer();
	const season = useScopeSeason(host);
	const items = getNavItems({ authenticated: true });
	const [open, setOpen] = useState(initial === "panel");
	const [compact, setCompact] = useState(initial === "compact");
	const [activeTo, setActiveTo] = useState<string | undefined>(
		resolveActiveNav("/blog", items)?.link.to,
	);
	return (
		<div
			ref={ref}
			style={{ width: PHONE_WIDTH }}
			className="relative mx-auto h-160 overflow-hidden rounded-2xl border border-border bg-background"
		>
			<div className="px-3 pt-2.5">
				<SiteNavbar
					items={items}
					active={resolveActiveNav("/blog", items)}
					logo={<Logo />}
					actions={<Actions season={season} member />}
					onSearch={() => {}}
					centerClassName="hidden"
					LinkComponent={StayLink}
				/>
			</div>
			<PageBody className="px-4 pt-10" />
			<SiteIsland
				items={items}
				activeTo={activeTo}
				open={open}
				onOpenChange={setOpen}
				compact={compact}
				onCompactChange={setCompact}
				onSelect={setActiveTo}
				viewportWidth={PHONE_WIDTH}
				routing={null}
				placement="container"
				LinkComponent={StayLink}
			/>
		</div>
	);
}

function NavbarSample({ state }: ExhibitRenderProps) {
	switch (state) {
		case "mobile":
			return <Mobile key={state} initial="tabs" />;
		case "mobile-panel":
			return <Mobile key={state} initial="panel" />;
		case "mobile-compact":
			return <Mobile key={state} initial="compact" />;
		default:
			return <Desktop preset={DESKTOP[state] ?? DESKTOP.rest} />;
	}
}

export const navbarExhibit: Exhibit = {
	id: "navbar",
	name: "导航栏",
	units: ["navbar"],
	zone: "banner",
	category: "navigation",
	footprint: { width: 1120, height: 680 },
	states: [
		{ id: "rest", label: "常规" },
		{ id: "detail", label: "详情页" },
		{ id: "child", label: "更多里的子页" },
		{ id: "scrolled", label: "收起" },
		{ id: "scrolled-detail", label: "收起·详情页" },
		{ id: "routing", label: "页面加载" },
		{ id: "guest", label: "登录前" },
		{ id: "mobile", label: "移动端" },
		{ id: "mobile-panel", label: "移动端·展开" },
		{ id: "mobile-compact", label: "移动端·收起" },
	],
	Render: NavbarSample,
};
