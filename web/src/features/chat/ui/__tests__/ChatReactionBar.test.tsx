import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageReaction } from "../../model/types";
import { ChatReactionBar } from "../ChatReactionBar";

function reaction(emojiID: number, self = false): ChatMessageReaction {
	return {
		emoji_id: emojiID,
		emoji_name: `[emoji-${emojiID}]`,
		emoji_url: "",
		gif_url: "",
		count: emojiID,
		self,
	};
}

afterEach(() => cleanup());

describe("ChatReactionBar", () => {
	it("默认展示六种 reaction，并可展开其余 reaction", () => {
		const reactions = Array.from({ length: 7 }, (_, index) => reaction(index + 1));
		render(<ChatReactionBar onToggle={vi.fn()} reactions={reactions} />);

		expect(screen.getByRole("button", { name: "展开其余 1 个表情" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /\[emoji-7\]/ })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "展开其余 1 个表情" }));
		expect(screen.getByRole("button", { name: /\[emoji-7\]/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: "收起表情" })).toBeTruthy();
	});

	it("高亮当前用户 reaction，并在点击时切换该表情", () => {
		const onToggle = vi.fn();
		render(<ChatReactionBar onToggle={onToggle} reactions={[reaction(1, true)]} />);

		const button = screen.getByRole("button", { name: /\[emoji-1\]/ });
		expect(button.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(button);
		expect(onToggle).toHaveBeenCalledWith(1);
	});
});
