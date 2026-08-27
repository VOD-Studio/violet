import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

	it.each([
		["none", "收藏到我的表情", favorite.mutate],
		["favorited", "移出我的表情", unfavorite.mutate],
		["owned", "删除表情", remove.mutate],
	] as const)("relation=%s 显示 %s 并调用对应 mutation", (relation, label, mutate) => {
		render(
			<CustomEmojiContextMenu>
				<img
					src="/custom.png"
					alt="自定义表情"
					data-custom-emoji-id="emoji-1"
					data-relation={relation}
				/>
			</CustomEmojiContextMenu>,
		);
		const image = screen.getByAltText("自定义表情");
		fireEvent.contextMenu(image);

		expect(screen.getByRole("menuitem").textContent).toContain(label);
		fireEvent.click(screen.getByRole("menuitem"));
		expect(mutate).toHaveBeenCalledWith("emoji-1");
	});
});
