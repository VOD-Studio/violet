import type { UserProfile } from "@entities/user/model/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfileHeader } from "../UserProfileHeader";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({
		children,
		to,
		...props
	}: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

const me = vi.hoisted(() => ({ current: undefined as { id: string } | undefined }));
vi.mock("@features/auth/api/queries", () => ({ useMe: () => ({ data: me.current }) }));

const createChat = vi.fn();
vi.mock("@features/chat/api/queries", () => ({
	useCreateChatConversation: () => ({ mutateAsync: createChat }),
}));

const profile: UserProfile = {
	id: "u1",
	username: "alice",
	display_name: "",
	avatar_url: "",
	bio: "",
	created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
	me.current = undefined;
	Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("UserProfileHeader", () => {
	it("显示名回退用户名，空简介给出提示，资料行展示推文数与含图数", () => {
		render(<UserProfileHeader profile={profile} tweetCount="12+" mediaCount={3} />);
		expect(screen.getByRole("heading", { name: "alice" })).toBeTruthy();
		expect(screen.getByText("@alice")).toBeTruthy();
		expect(screen.getByText("还没有留下简介。")).toBeTruthy();
		expect(screen.getByText("12+").parentElement?.textContent).toContain("条推文");
		expect(screen.getByText("3").parentElement?.textContent).toContain("条含图");
	});

	it("本人看到编辑资料而不是私聊", () => {
		me.current = { id: "u1" };
		render(<UserProfileHeader profile={profile} tweetCount="0" mediaCount={0} />);
		expect(screen.getByRole("link", { name: /编辑资料/ }).getAttribute("href")).toBe(
			"/profile",
		);
		expect(screen.queryByRole("button", { name: /发起私聊/ })).toBeNull();
	});

	it("未登录访客点击私聊先去登录，不创建会话", () => {
		render(<UserProfileHeader profile={profile} tweetCount="0" mediaCount={0} />);
		fireEvent.click(screen.getByRole("button", { name: /发起私聊/ }));
		expect(createChat).not.toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "/login",
				search: expect.objectContaining({ redirect: expect.any(String) }),
			}),
		);
	});

	it("登录访客发起私聊后进入会话；创建失败时留在原页", async () => {
		me.current = { id: "me" };
		createChat.mockResolvedValueOnce({ id: "c1" });
		render(<UserProfileHeader profile={profile} tweetCount="0" mediaCount={0} />);
		fireEvent.click(screen.getByRole("button", { name: /发起私聊/ }));
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/chat", search: { c: "c1" } }),
		);
		expect(createChat).toHaveBeenCalledWith({ kind: "direct", participant_ids: ["u1"] });

		navigate.mockClear();
		createChat.mockRejectedValueOnce(new Error("boom"));
		fireEvent.click(screen.getByRole("button", { name: /发起私聊/ }));
		await waitFor(() => expect(createChat).toHaveBeenCalledTimes(2));
		expect(navigate).not.toHaveBeenCalled();
	});

	it("复制用户名与主页链接", async () => {
		render(<UserProfileHeader profile={profile} tweetCount="0" mediaCount={0} />);
		fireEvent.click(screen.getByRole("button", { name: "复制用户名" }));
		await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("@alice"));
		fireEvent.click(screen.getByRole("button", { name: "复制主页链接" }));
		await waitFor(() =>
			expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(window.location.href),
		);
	});
});
