import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({
	data: undefined as { hide_online: boolean } | undefined,
	isError: false,
	refetch: vi.fn(),
}));
const update = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("../../api/queries", () => ({
	useChatSettings: () => settings,
	useUpdateChatSettings: () => update,
}));

import { PresenceVisibilityButton } from "../PresenceVisibilityButton";

afterEach(() => {
	cleanup();
	settings.data = undefined;
	settings.isError = false;
	vi.clearAllMocks();
});

it("按当前设置显示可见或隐身，点击切换", () => {
	settings.data = { hide_online: false };
	render(<PresenceVisibilityButton />);
	fireEvent.click(screen.getByRole("button", { name: "在线状态：对成员可见" }));
	expect(update.mutate).toHaveBeenCalledWith({ hide_online: true });
	cleanup();
	settings.data = { hide_online: true };
	render(<PresenceVisibilityButton />);
	expect(
		screen.getByRole("button", { name: "在线状态：已隐身" }).getAttribute("aria-pressed"),
	).toBe("true");
});

it("读取设置失败时不冒充可见状态，点击重试", () => {
	settings.isError = true;
	render(<PresenceVisibilityButton />);
	expect(screen.queryByRole("button", { name: "在线状态：对成员可见" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "在线状态：读取失败，点击重试" }));
	expect(settings.refetch).toHaveBeenCalledOnce();
});
