import {
	Dropdown,
	DropdownContent,
	DropdownGroup,
	DropdownItem,
	DropdownTrigger,
} from "@violet/ui";
import { BookOpen, Compass, Copy, Link2, type LucideIcon, ScrollText } from "lucide-react";
import type { Exhibit } from "../../model/exhibit";
import { StayLink } from "./stay-link";

const TRIGGER_CLASS =
	"inline-flex h-9 items-center rounded-full px-4 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted";

interface Entry {
	label: string;
	hint: string;
	icon: LucideIcon;
}

const GUIDES: Entry[] = [
	{ label: "快速入门", hint: "十分钟接入组件库", icon: Compass },
	{ label: "设计原则", hint: "颜色、动效与排版的取舍", icon: BookOpen },
	{ label: "版本记录", hint: "每个版本改了什么", icon: ScrollText },
];
const ACTIONS: Entry[] = [
	{ label: "复制链接", hint: "把当前页面地址放进剪贴板", icon: Copy },
	{ label: "查看源码", hint: "在仓库里打开这一页", icon: Link2 },
];

/** 图标块、粗体名称与一行说明：站点「更多」菜单的项结构。 */
function EntryRow({ entry, href }: { entry: Entry; href: string }) {
	const Icon = entry.icon;
	return (
		<DropdownItem asChild>
			<StayLink href={href}>
				<span
					aria-hidden="true"
					className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
				>
					<Icon className="size-4" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm leading-none font-semibold">{entry.label}</span>
					<span className="mt-1.5 block truncate text-xs leading-none text-muted-foreground">
						{entry.hint}
					</span>
				</span>
			</StayLink>
		</DropdownItem>
	);
}

/** 同组的链接与按钮两种触发器，加一个向上展开的面板。 */
function DropdownStage() {
	return (
		<div className="flex h-full flex-col justify-between">
			<DropdownGroup>
				<nav aria-label="Dropdown 示例" className="flex items-center gap-2">
					<Dropdown>
						<DropdownTrigger asChild>
							<StayLink href="#guides" className={TRIGGER_CLASS}>
								指南
							</StayLink>
						</DropdownTrigger>
						<DropdownContent side="bottom" align="start" className="w-70">
							{GUIDES.map((entry, index) => (
								<EntryRow
									key={entry.label}
									entry={entry}
									href={`#guide-${index + 1}`}
								/>
							))}
						</DropdownContent>
					</Dropdown>
					<Dropdown>
						<DropdownTrigger className={TRIGGER_CLASS}>更多</DropdownTrigger>
						<DropdownContent side="bottom" align="start" className="w-70">
							{ACTIONS.map((entry, index) => (
								<EntryRow
									key={entry.label}
									entry={entry}
									href={`#action-${index + 1}`}
								/>
							))}
						</DropdownContent>
					</Dropdown>
				</nav>
			</DropdownGroup>
			<Dropdown>
				<DropdownTrigger className={`${TRIGGER_CLASS} self-start`}>
					向上展开
				</DropdownTrigger>
				<DropdownContent side="top" align="start" className="w-70">
					{ACTIONS.map((entry, index) => (
						<EntryRow key={entry.label} entry={entry} href={`#upward-${index + 1}`} />
					))}
				</DropdownContent>
			</Dropdown>
		</div>
	);
}

export const dropdownExhibit: Exhibit = {
	id: "dropdown",
	name: "下拉面板",
	units: ["dropdown"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 320, height: 260 },
	Render: DropdownStage,
};
