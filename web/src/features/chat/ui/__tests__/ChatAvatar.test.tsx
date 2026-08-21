import type { ChatUser } from "@features/chat/model/types";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		className,
		"aria-label": ariaLabel,
	}: {
		to: string;
		params?: { username?: string };
		children: ReactNode;
		className?: string;
		"aria-label"?: string;
	}) => (
		<a
			aria-label={ariaLabel}
			className={className}
			href={params?.username ? `/users/${params.username}` : to}
		>
			{children}
		</a>
	),
}));

import { ChatAvatar } from "../ChatAvatar";

const user = (overrides: Partial<ChatUser> = {}): ChatUser => ({
	id: "u1",
	username: "alice",
	display_name: "Alice",
	avatar_url: "https://example.com/alice.webp",
	...overrides,
});

describe("ChatAvatar", () => {
	it("links an image avatar to the user's public profile", () => {
		render(<ChatAvatar user={user()} className="size-8" />);

		const link = screen.getByRole("link", { name: "Alice 的个人主页" });
		expect(link.getAttribute("href")).toBe("/users/alice");
		expect(screen.getByAltText("Alice 的头像")).toBeTruthy();
	});

	it("links the fallback avatar to the user's public profile", () => {
		render(<ChatAvatar user={user({ username: "bob", display_name: "", avatar_url: "" })} />);

		const link = screen.getByRole("link", { name: "bob 的个人主页" });
		expect(link.getAttribute("href")).toBe("/users/bob");
		expect(screen.getByText("B")).toBeTruthy();
	});
});
