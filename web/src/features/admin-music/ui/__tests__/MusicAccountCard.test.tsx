import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query-client";
import type { MusicAccount, MusicStatus } from "../../model/types";
import { MusicAccountCard } from "../MusicAccountCard";

// Mock 权限与 queries
vi.mock("@/features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("../../api/queries", () => ({
	useVerifyMusic: () => ({
		mutateAsync: vi.fn().mockResolvedValue({ valid: true, message: "验证成功" }),
		isPending: false,
	}),
	useRefreshMusicAccount: () => ({
		mutateAsync: vi.fn().mockResolvedValue({ state: "connected", profile: null }),
		isPending: false,
	}),
	useDisconnectMusicAccount: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("MusicAccountCard", () => {
	let qc = createQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);

	beforeEach(() => {
		qc = createQueryClient();
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("展示 Kite 状态及连通性按钮", () => {
		const status: MusicStatus = {
			configured: true,
			credential_storage_ready: true,
			base_url: "http://kite:3721",
		};

		render(<MusicAccountCard status={status} onOpenQrLogin={vi.fn()} />, { wrapper });

		expect(screen.getByText("Kite 音乐服务")).toBeDefined();
		expect(screen.getByText("已配置服务地址与令牌")).toBeDefined();
		expect(screen.getByText("加密密钥可用")).toBeDefined();
		expect(screen.getByText("http://kite:3721")).toBeDefined();
		expect(screen.getByText("连通性测试")).toBeDefined();
	});

	it("展示已连接账号信息与刷新按钮", () => {
		const account: MusicAccount = {
			state: "connected",
			profile: {
				id: "123456",
				nickname: "测试账号",
				avatar_url: "https://example.com/avatar.jpg",
			},
		};

		render(<MusicAccountCard account={account} onOpenQrLogin={vi.fn()} />, { wrapper });

		expect(screen.getByText("测试账号")).toBeDefined();
		expect(screen.getByText("UID: 123456")).toBeDefined();
		expect(screen.getByText("已连接")).toBeDefined();
		expect(screen.getByText("刷新")).toBeDefined();
		expect(screen.getByText("断开")).toBeDefined();
	});

	it("未连接时展示引导文案并响应扫码点击", () => {
		const onOpenQrLogin = vi.fn();
		render(
			<MusicAccountCard
				account={{ state: "disconnected", profile: null }}
				onOpenQrLogin={onOpenQrLogin}
			/>,
			{ wrapper },
		);

		expect(screen.getByText("未连接")).toBeDefined();
		const loginBtn = screen.getByText("扫码连接账号");
		fireEvent.click(loginBtn);
		expect(onOpenQrLogin).toHaveBeenCalled();
	});
});
