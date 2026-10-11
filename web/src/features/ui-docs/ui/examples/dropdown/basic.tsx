import { Dropdown, DropdownContent, DropdownGroup, DropdownTrigger } from "@violet/ui";
import { type ComponentProps, useState } from "react";

const TRIGGER_CLASS =
	"inline-flex h-9 items-center rounded-full px-4 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted";
const ITEM_CLASS =
	"block rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted";

const GUIDE_LINKS = ["快速入门", "设计原则", "版本记录"];
const ACTIONS = ["复制链接", "查看源码"];

/** 示例链接只阻止默认跳转，保持在文档页内；ref 与其余属性透传，可作 asChild 触发器。 */
function DocLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
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

/** 同组两个悬停面板：链接触发器与普通按钮触发器，并显示各自的展开状态。 */
export function DropdownBasicDemo() {
	const [guideOpen, setGuideOpen] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);

	return (
		<div className="w-full max-w-sm space-y-4">
			<DropdownGroup>
				<nav aria-label="Dropdown 示例" className="flex items-center gap-2">
					<Dropdown onOpenChange={setGuideOpen}>
						<DropdownTrigger asChild>
							<DocLink href="#guides-index" className={TRIGGER_CLASS}>
								指南
							</DocLink>
						</DropdownTrigger>
						<DropdownContent side="bottom" align="start">
							{GUIDE_LINKS.map((label, index) => (
								<DocLink
									key={label}
									href={`#guide-${index + 1}`}
									className={ITEM_CLASS}
								>
									{label}
								</DocLink>
							))}
						</DropdownContent>
					</Dropdown>
					<Dropdown onOpenChange={setMoreOpen}>
						<DropdownTrigger className={TRIGGER_CLASS}>更多</DropdownTrigger>
						<DropdownContent side="bottom" align="start">
							{ACTIONS.map((label, index) => (
								<DocLink
									key={label}
									href={`#action-${index + 1}`}
									className={ITEM_CLASS}
								>
									{label}
								</DocLink>
							))}
						</DropdownContent>
					</Dropdown>
				</nav>
			</DropdownGroup>
			<Dropdown>
				<DropdownTrigger className={TRIGGER_CLASS}>向上展开</DropdownTrigger>
				<DropdownContent side="top" align="start">
					{ACTIONS.map((label, index) => (
						<DocLink
							key={label}
							href={`#upward-action-${index + 1}`}
							className={ITEM_CLASS}
						>
							{label}
						</DocLink>
					))}
				</DropdownContent>
			</Dropdown>
			<p className="text-sm text-muted-foreground" aria-live="polite">
				指南面板：{guideOpen ? "展开" : "收起"}；更多面板：{moreOpen ? "展开" : "收起"}。
			</p>
		</div>
	);
}
