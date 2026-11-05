import {
	Dropdown,
	DropdownContent,
	DropdownGroup,
	DropdownItem,
	DropdownTrigger,
} from "@violet/ui";
import type { ComponentProps } from "react";
import type { Exhibit } from "../../model/exhibit";

const TRIGGER_CLASS =
	"inline-flex h-9 items-center rounded-full px-4 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted";

const GUIDES = ["快速入门", "设计原则", "版本记录"];
const ACTIONS = ["复制链接", "查看源码"];

/** 展品里的链接只阻止跳转；ref 与其余属性透传，可作 asChild 触发器。 */
function StayLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
	return (
		<a
			href={href}
			{...props}
			onClick={(event) => {
				onClick?.(event);
				event.preventDefault();
			}}
		/>
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
						<DropdownContent side="bottom" align="start">
							{GUIDES.map((label, index) => (
								<DropdownItem asChild key={label}>
									<StayLink href={`#guide-${index + 1}`}>{label}</StayLink>
								</DropdownItem>
							))}
						</DropdownContent>
					</Dropdown>
					<Dropdown>
						<DropdownTrigger className={TRIGGER_CLASS}>更多</DropdownTrigger>
						<DropdownContent side="bottom" align="start">
							{ACTIONS.map((label, index) => (
								<DropdownItem asChild key={label}>
									<StayLink href={`#action-${index + 1}`}>{label}</StayLink>
								</DropdownItem>
							))}
						</DropdownContent>
					</Dropdown>
				</nav>
			</DropdownGroup>
			<Dropdown>
				<DropdownTrigger className={`${TRIGGER_CLASS} self-start`}>
					向上展开
				</DropdownTrigger>
				<DropdownContent side="top" align="start">
					{ACTIONS.map((label, index) => (
						<DropdownItem asChild key={label}>
							<StayLink href={`#upward-${index + 1}`}>{label}</StayLink>
						</DropdownItem>
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
