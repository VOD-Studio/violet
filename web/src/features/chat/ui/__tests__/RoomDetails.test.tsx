/**
 * RoomDetails 组件测试
 *
 * 锁定动画模式选择：xl 起抽屉在文档流内，必须用宽度动画驱动 flex 重排
 * （聊天区同帧伸缩）；xl 以下为覆盖式位移动画。回归场景：xl 下若退回
 * x 位移，退出动画期间抽屉仍占布局，聊天区会等动画结束后才突变撑宽。
 * jsdom 无布局引擎，断言语义落在 initial 样式的属性选择上（width vs transform）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

vi.mock("../../hooks/useChatPushNotifications", () => ({
	useChatPushNotifications: () => ({
		permission: "default",
		enabled: false,
		supported: true,
		busy: false,
		enable: vi.fn(),
		disable: vi.fn(),
		updatePreview: vi.fn(),
	}),
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
	// jsdom 原生无 matchMedia，删除以恢复「未定义」的默认状态
	Reflect.deleteProperty(window, "matchMedia");
});

describe("RoomDetails 动画模式", () => {
	it("xl 断点：宽度动画（与聊天区同帧重排）", () => {
		stubMatchMedia(true);
		render(
			<RoomDetails
				conversation={mockConversation}
				currentUserID={mockUser.id}
				members={mockMembers}
				onClose={() => {}}
			/>,
		);
		const aside = screen.getByRole("complementary");
		expect(aside.style.width).toBe("0px");
		expect(aside.style.transform).not.toContain("translateX");
	});

	it("xl 以下：覆盖式位移动画（聊天区不参与布局变化）", () => {
		stubMatchMedia(false);
		render(
			<RoomDetails
				conversation={mockConversation}
				currentUserID={mockUser.id}
				members={mockMembers}
				onClose={() => {}}
			/>,
		);
		const aside = screen.getByRole("complementary");
		expect(aside.style.transform).toBe("translateX(100%)");
		expect(aside.style.width).toBe("");
	});
});
