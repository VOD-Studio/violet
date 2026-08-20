import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TweetContent } from "../TweetContent";

interface LinkProps extends ComponentProps<"a"> {
	to?: string;
	params?: Record<string, string>;
}

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params, onClick, ...props }: LinkProps) => (
		<a
			href={to?.replace("$tag", params?.tag || "")}
			onClick={onClick}
			data-testid="hashtag-link"
			{...props}
		>
			{children}
		</a>
	),
}));

describe("TweetContent Component", () => {
	it("renders plain text without hashtags", () => {
		render(<TweetContent content="今天天气真不错" />);
		expect(screen.getByText("今天天气真不错")).toBeTruthy();
		expect(screen.queryByTestId("hashtag-link")).toBeNull();
	});

	it("parses hashtags into clickable links", () => {
		render(<TweetContent content="讨论一下 #Golang# 和 #React# 话题" />);
		expect(screen.getByText(/讨论一下/)).toBeTruthy();
		expect(screen.getByText(/和/)).toBeTruthy();
		expect(screen.getByText(/话题/)).toBeTruthy();

		const links = screen.getAllByTestId("hashtag-link");
		expect(links).toHaveLength(2);
		expect(links[0].textContent).toBe("#Golang#");
		expect(links[0].getAttribute("href")).toBe("/tweets/topics/Golang");
		expect(links[1].textContent).toBe("#React#");
		expect(links[1].getAttribute("href")).toBe("/tweets/topics/React");
	});

	it("renders inline emoji images when emote mapping is provided", () => {
		const emote = {
			"[doge]": { url: "https://emoji.test/doge.png" },
		};
		render(<TweetContent content="今天心情很好 [doge] 汪汪" emote={emote} />);
		expect(screen.getByText(/今天心情很好/)).toBeTruthy();
		expect(screen.getByText(/汪汪/)).toBeTruthy();

		const emojiImg = screen.getByAltText("[doge]");
		expect(emojiImg).toBeTruthy();
		expect(emojiImg.getAttribute("src")).toBe("https://emoji.test/doge.png");
	});

	it("handles hashtags and emojis coexisting in text", () => {
		const emote = {
			"[cat]": { url: "https://emoji.test/cat.png", size: 2 },
		};
		render(<TweetContent content="#猫咪# 来看可爱的小猫 [cat] 喵~" emote={emote} />);

		const link = screen.getByTestId("hashtag-link");
		expect(link.textContent).toBe("#猫咪#");

		const emojiImg = screen.getByAltText("[cat]");
		expect(emojiImg.getAttribute("src")).toBe("https://emoji.test/cat.png");
		expect(screen.getByText(/来看可爱的小猫/)).toBeTruthy();
	});
});
