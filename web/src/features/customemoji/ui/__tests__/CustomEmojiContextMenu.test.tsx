import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@violet/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const favorite = { mutate: vi.fn(), isPending: false };
const unfavorite = { mutate: vi.fn(), isPending: false };
const remove = { mutate: vi.fn(), isPending: false };

vi.mock("@features/customemoji/api/queries", () => ({
	useFavoriteCustomEmoji: () => favorite,
	useUnfavoriteCustomEmoji: () => unfavorite,
	useDeleteCustomEmoji: () => remove,
}));

import { CustomEmojiContextMenu } from "../CustomEmojiContextMenu";

describe("CustomEmojiContextMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		cleanup();
	});

	it("系统表情与普通内容保留浏览器原生右键菜单", () => {
		const { container } = render(
			<CustomEmojiContextMenu>
				<div>
					<img src="/system.png" alt="系统表情" />
					<span>普通内容</span>
				</div>
			</CustomEmojiContextMenu>,
		);
		const systemImage = screen.getByAltText("系统表情");
		const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
		systemImage.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(container.querySelector('[role="menuitem"]')).toBeNull();
	});

	it("页面里自带 ContextMenu 的区域照常打开自己的菜单，普通内容仍是原生菜单", () => {
		render(
			<CustomEmojiContextMenu>
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<article>一行文章</article>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem>编辑</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
				<span>普通内容</span>
			</CustomEmojiContextMenu>,
		);

		// fireEvent 在事件被 preventDefault 时返回 false
		expect(fireEvent.contextMenu(screen.getByText("普通内容"))).toBe(true);
		expect(screen.queryByRole("menuitem")).toBeNull();

		expect(fireEvent.contextMenu(screen.getByText("一行文章"))).toBe(false);
		expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["编辑"]);
	});

	it.each(
		(
			[
				["none", "收藏到我的表情", favorite.mutate],
				["favorited", "移出我的表情", unfavorite.mutate],
				["owned", "删除表情", remove.mutate],
			] as const
		).flatMap(([relation, label, mutate]) =>
			(["image", "button"] as const).map((target) => ({ relation, label, mutate, target })),
		),
	)("relation=$relation 从 $target 打开 $label", ({ relation, label, mutate, target }) => {
		render(
			<CustomEmojiContextMenu>
				<button type="button" aria-label="查看表情">
					<img
						src="/custom.png"
						alt="自定义表情"
						data-custom-emoji-id="emoji-1"
						data-relation={relation}
					/>
				</button>
			</CustomEmojiContextMenu>,
		);
		fireEvent.contextMenu(
			target === "image"
				? screen.getByAltText("自定义表情")
				: screen.getByRole("button", { name: "查看表情" }),
		);

		expect(screen.getByRole("menuitem").textContent).toContain(label);
		fireEvent.click(screen.getByRole("menuitem"));
		expect(mutate).toHaveBeenCalledWith("emoji-1");
	});
});
