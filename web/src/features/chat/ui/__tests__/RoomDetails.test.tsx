import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ChatConversation, ChatMember } from "../../model/types";

vi.mock("../../api/client", () => ({
	fetchChatUser: vi.fn(),
}));

vi.mock("../../api/queries", () => ({
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
	{ user: mockUser, role: "owner", joined_at: "2026-08-20T08:00:00Z", is_muted: false },
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
	fireEvent.click(screen.getByRole("button", { name: "启用浏览器通知" }));
	expect(push.enable).toHaveBeenCalledWith(false);
	expect(push.disable).not.toHaveBeenCalled();
});
