import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminPresenceDevice } from "../../model/types";
import { PresenceDevicesCard } from "../PresenceDevicesCard";

let devices: AdminPresenceDevice[] = [];
let canManage = true;
vi.mock("@/features/auth/hooks/usePermissions", () => ({ useHasPermission: () => canManage }));
vi.mock("../../api/queries", () => ({
	usePresenceDevices: () => ({ data: devices, isLoading: false, isError: false }),
	useRevokePresenceDevice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const online: AdminPresenceDevice = {
	id: "d1",
	display_name: "MacBook Pro",
	created_at: "2026-10-01T12:00:00Z",
	online: true,
	updated_at: new Date().toISOString(),
	expires_at: new Date(Date.now() + 45_000).toISOString(),
	sources: {
		application: { display_name: "Code" },
		window: null,
		media: {
			session_id: "30000000-0000-4000-8000-000000000003",
			player_name: "QQ 音乐",
			title: "晴天",
			artist: "周杰伦",
			album: null,
			state: "paused",
			duration_ms: null,
			position_ms: null,
			rate: 0,
		},
	},
};

describe("PresenceDevicesCard", () => {
	afterEach(cleanup);

	it("在线设备列出各来源摘要，离线设备显示签发日期", () => {
		canManage = true;
		devices = [
			online,
			{
				...online,
				id: "d2",
				display_name: "Mac mini",
				online: false,
				updated_at: null,
				expires_at: null,
				sources: null,
			},
		];
		render(<PresenceDevicesCard onIssue={vi.fn()} />);
		expect(screen.getByText("已暂停：晴天 — 周杰伦")).toBeTruthy();
		expect(screen.getByText("正在使用 Code")).toBeTruthy();
		expect(screen.getByText("在线")).toBeTruthy();
		expect(screen.getByText("离线")).toBeTruthy();
		expect(screen.getByText("签发于 2026-10-01")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "撤销" })).toHaveLength(2);
	});

	it("只读权限不显示签发与撤销", () => {
		canManage = false;
		devices = [online];
		render(<PresenceDevicesCard onIssue={vi.fn()} />);
		expect(screen.queryByRole("button", { name: "签发凭证" })).toBeNull();
		expect(screen.queryByRole("button", { name: "撤销" })).toBeNull();
	});

	it("没有设备时给出下一步提示", () => {
		canManage = true;
		devices = [];
		render(<PresenceDevicesCard onIssue={vi.fn()} />);
		expect(screen.getByText(/还没有设备/)).toBeTruthy();
	});
});
