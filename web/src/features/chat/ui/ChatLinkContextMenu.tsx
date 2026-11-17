import { copyText } from "@shared/lib/clipboard";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@violet/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { toast } from "sonner";

/** 链接或复合卡片右键菜单；卡片内的实际锚点优先于卡片来源地址。 */
export interface ChatLinkContextMenuProps {
	href: string;
	children: ReactElement;
}

/** 保留原生打开链接行为，并为 Shift+F10 和菜单键提供同一复制入口。 */
export function ChatLinkContextMenu({ href, children }: ChatLinkContextMenuProps) {
	const [selectedHref, setSelectedHref] = useState(href);
	const copy = async () => {
		try {
			if (await copyText(selectedHref)) {
				toast.success("链接已复制");
			} else {
				toast.error("复制失败，请重试或手动复制链接");
			}
		} catch {
			toast.error("复制失败，请重试或手动复制链接");
		}
	};
	return (
		<ContextMenu>
			<ContextMenuTrigger
				asChild
				onContextMenu={(event) => {
					const anchor =
						event.target instanceof Element ? event.target.closest("a[href]") : null;
					const actualHref = anchor instanceof HTMLAnchorElement ? anchor.href : href;
					setSelectedHref(/^https?:\/\//i.test(actualHref) ? actualHref : href);
					event.stopPropagation();
				}}
				onKeyDown={(event) => {
					if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))
						return;
					event.preventDefault();
					event.stopPropagation();
					const target =
						event.target instanceof HTMLElement ? event.target : event.currentTarget;
					const rect = target.getBoundingClientRect();
					target.dispatchEvent(
						new MouseEvent("contextmenu", {
							bubbles: true,
							cancelable: true,
							clientX: rect.left,
							clientY: rect.bottom,
						}),
					);
				}}
			>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent aria-label="链接操作">
				<ContextMenuItem asChild>
					<a href={selectedHref} target="_blank" rel="noopener noreferrer">
						打开链接
					</a>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => void copy()}>复制链接</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
