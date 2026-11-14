import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ChatConversation, ChatMember } from "../../model/types";

vi.mock("../../api/client", () => ({
	fetchChatUser: vi.fn(),
}));

const botCatalogs = vi.hoisted(() => ({
	data: undefined as { bots: { bot_user_id: string; description: string }[] } | undefined,
	isError: false,
}));
const setSpeaking = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("../../api/queries", () => ({
	useBotCommands: () => botCatalogs,
	useSetBotSpeaking: () => setSpeaking,
	useRenameChatConversation: () => ({ mutateAsync: vi.fn() }),
	useInviteChatMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
	useRemoveChatMember: () => ({ mutate: vi.fn(), isPending: false }),
	useSetChatMuted: () => ({ mutate: vi.fn() }),
	useLeaveChatConversation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const push = vi.hoisted(() => ({
	permission: "default",
	enabled: false,
	subscribed: false,
	supported: true,
	busy: false,
	enable: vi.fn(),
	disable: vi.fn(),
	updatePreview: vi.fn(),
}));

vi.mock("../../hooks/useChatPushNotifications", () => ({
	useChatPushNotifications: () => push,
}));

vi.mock("../ChatAvatar", () => ({ ChatAvatar: () => null }));

import { RoomDetails } from "../RoomDetails";

const mockUser = {
	id: "u_me",
	username: "xfy",
	display_name: "xfy",
	avatar_url: "",
};

const mockConversation: ChatConversation = {
	id: "c_1",
	kind: "room",
	title: "周末球局",
	owner: mockUser,
	unread_count: 0,
	created_at: "2026-08-20T08:00:00Z",
	updated_at: "2026-08-20T08:30:00Z",
};

const mockMembers: ChatMember[] = [
	{
		user: mockUser,
		role: "owner",
		joined_at: "2026-08-20T08:00:00Z",
		is_muted: false,
		online: false,
		can_speak: true,
	},
];

const stubMatchMedia = (matches: boolean) => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
};

afterEach(() => {
	cleanup();
	push.enabled = false;
	push.subscribed = false;
	push.permission = "default";
	vi.clearAllMocks();
	// jsdom 原生无 matchMedia，删除以恢复「未定义」的默认状态
	Reflect.deleteProperty(window, "matchMedia");
});

it("已有通知权限但没有订阅时，设置按钮可以重新启用通知", () => {
	stubMatchMedia(true);
	push.enabled = true;
	push.permission = "granted";
	render(
		<RoomDetails
			conversation={mockConversation}
			currentUserID={mockUser.id}
			members={mockMembers}
			onClose={() => {}}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "浏览器通知" }));
	fireEvent.click(screen.getByRole("button", { name: "启用浏览器通知" }));
	expect(push.enable).toHaveBeenCalledWith(false);
	expect(push.disable).not.toHaveBeenCalled();
});

it("在场的角色与成员分开列出，角色带简介，成员数不含角色", () => {
	stubMatchMedia(true);
	botCatalogs.data = { bots: [{ bot_user_id: "u_rua", description: "看板娘，爱推荐歌" }] };
	const rua = { id: "u_rua", username: "rua", display_name: "Rua", avatar_url: "", is_bot: true };
	const members: ChatMember[] = [
		...mockMembers,
		{
			user: rua,
			role: "member",
			joined_at: "2026-08-20T08:05:00Z",
			is_muted: false,
			online: false,
			can_speak: true,
		},
	];
	render(
		<RoomDetails
			conversation={mockConversation}
			currentUserID={mockUser.id}
			members={members}
			onClose={vi.fn()}
		/>,
	);
	const roles = screen.getByRole("region", { name: "在场的角色" });
	expect(roles.textContent).toContain("Rua");
	expect(roles.textContent).toContain("看板娘，爱推荐歌");
	expect(screen.getByText("在场的角色 · 1")).toBeTruthy();
	expect(screen.getByText("成员 · 1")).toBeTruthy();
	botCatalogs.data = undefined;
});

it("没有角色时不显示在场的角色分区", () => {
	stubMatchMedia(true);
	render(
		<RoomDetails
			conversation={mockConversation}
			currentUserID={mockUser.id}
			members={mockMembers}
			onClose={vi.fn()}
		/>,
	);
	expect(screen.queryByRole("region", { name: "在场的角色" })).toBeNull();
});

const rua = { id: "u_rua", username: "rua", display_name: "Rua", avatar_url: "", is_bot: true };
const withRua = (canSpeak: boolean): ChatMember[] => [
	...mockMembers,
	{
		user: rua,
		role: "member",
		joined_at: "2026-08-20T08:05:00Z",
		is_muted: false,
		online: false,
		can_speak: canSpeak,
	},
];
const renderDetails = (members: ChatMember[], currentUserID = mockUser.id) =>
	render(
		<RoomDetails
			conversation={mockConversation}
			currentUserID={currentUserID}
			members={members}
			onClose={vi.fn()}
		/>,
	);

it("房主可以切换角色的发言权限", () => {
	stubMatchMedia(true);
	renderDetails(withRua(true));
	const toggle = screen.getByRole("switch", { name: "允许 Rua 发言" });
	expect(toggle.getAttribute("aria-checked")).toBe("true");
	fireEvent.click(toggle);
	expect(setSpeaking.mutate).toHaveBeenCalledWith({
		id: "c_1",
		userId: "u_rua",
		allowed: false,
	});
});

it("非房主看不到发言开关，被禁言的角色显示已禁言", () => {
	stubMatchMedia(true);
	const guest = { id: "u_guest", username: "guest", display_name: "Guest", avatar_url: "" };
	renderDetails(
		[
			...withRua(false),
			{
				user: guest,
				role: "member",
				joined_at: "2026-08-20T08:06:00Z",
				is_muted: false,
				online: false,
				can_speak: true,
			},
		],
		guest.id,
	);
	expect(screen.queryByRole("switch", { name: "允许 Rua 发言" })).toBeNull();
	expect(screen.getByText("已禁言")).toBeTruthy();
});

it("站长在成员列表里带站长标记，简介加载失败时给出提示", () => {
	stubMatchMedia(true);
	botCatalogs.isError = true;
	renderDetails([
		{ ...mockMembers[0], user: { ...mockUser, is_site_owner: true } },
		...withRua(true).slice(1),
	]);
	expect(screen.getByText("站长")).toBeTruthy();
	expect(screen.getByText("角色简介暂时无法加载")).toBeTruthy();
	botCatalogs.isError = false;
});
