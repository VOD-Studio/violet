import type * as MusicClient from "@features/admin-music/api/client";
import {
	cancelMusicLoginQR,
	checkMusicLoginQR,
	createMusicLoginQR,
} from "@features/admin-music/api/client";
import { adminMusicKeys } from "@features/admin-music/api/keys";
import type { MusicAccount, MusicChallenge } from "@features/admin-music/model/types";
import { MusicLoginQrDialog } from "@features/admin-music/ui/MusicLoginQrDialog";
import { ApiError } from "@shared/api/error";
import { createQueryClient } from "@shared/api/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@features/admin-music/api/client", async (importOriginal) => ({
	...(await importOriginal<typeof MusicClient>()),
	createMusicLoginQR: vi.fn(),
	checkMusicLoginQR: vi.fn(),
	cancelMusicLoginQR: vi.fn(),
}));

const connectedAccount: MusicAccount = {
	state: "connected",
	profile: { id: "123", nickname: "Rua", avatar_url: "" },
};

function challenge(id: string, duration = 180_000): MusicChallenge {
	return {
		id,
		url: `https://music.163.com/login?codekey=${id}`,
		expires_at: new Date(Date.now() + duration).toISOString(),
	};
}

describe("扫码登录生命周期", () => {
	let queryClient = createQueryClient();

	function wrapper({ children }: { children: ReactNode }) {
		return (
			<StrictMode>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</StrictMode>
		);
	}

	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetAllMocks();
		queryClient = createQueryClient();
		vi.mocked(cancelMusicLoginQR).mockResolvedValue(undefined);
		vi.mocked(checkMusicLoginQR).mockResolvedValue({ state: "waiting", account: null });
	});

	afterEach(() => {
		cleanup();
		queryClient.clear();
		vi.useRealTimers();
	});

	it("创建失败后保持错误态，重渲染与等待不会自动重发，只有手动重试才重新创建", async () => {
		vi.mocked(createMusicLoginQR).mockRejectedValue(
			new ApiError({ error: "BAD_REQUEST", message: "尚未配置 Kite 音乐服务", status: 400 }),
		);
		const onOpenChange = vi.fn();
		const { rerender } = render(<MusicLoginQrDialog open onOpenChange={onOpenChange} />, {
			wrapper,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(screen.getByRole("alert").textContent).toContain("尚未配置 Kite 音乐服务");
		for (let index = 0; index < 3; index++) {
			rerender(<MusicLoginQrDialog open onOpenChange={onOpenChange} />);
		}
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(createMusicLoginQR).toHaveBeenCalledTimes(1);
		expect(checkMusicLoginQR).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(createMusicLoginQR).toHaveBeenCalledTimes(2);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("关闭中止创建请求，迟到的挑战只被清理；重新打开使用全新挑战", async () => {
		let resolveFirst: (value: MusicChallenge) => void = () => {
			throw new Error("创建请求未开始");
		};
		const firstRequest = new Promise<MusicChallenge>((resolve) => {
			resolveFirst = resolve;
		});
		let firstSignal: AbortSignal | undefined;
		vi.mocked(createMusicLoginQR)
			.mockImplementationOnce((signal) => {
				firstSignal = signal;
				return firstRequest;
			})
			.mockResolvedValueOnce(challenge("new"));
		const onOpenChange = vi.fn();
		const { rerender } = render(<MusicLoginQrDialog open onOpenChange={onOpenChange} />, {
			wrapper,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		rerender(<MusicLoginQrDialog open={false} onOpenChange={onOpenChange} />);
		expect(firstSignal?.aborted).toBe(true);
		await act(async () => {
			resolveFirst(challenge("old"));
		});
		expect(vi.mocked(cancelMusicLoginQR).mock.calls.map(([id]) => id)).toEqual(["old"]);
		expect(checkMusicLoginQR).not.toHaveBeenCalled();
		rerender(<MusicLoginQrDialog open onOpenChange={onOpenChange} />);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(createMusicLoginQR).toHaveBeenCalledTimes(2);
		expect(checkMusicLoginQR).toHaveBeenCalledWith("new", expect.any(AbortSignal));
	});

	it("正常扫码只创建一次，确认成功同步账号并停止轮询，不取消已完成挑战", async () => {
		vi.mocked(createMusicLoginQR).mockResolvedValue(challenge("confirmed"));
		vi.mocked(checkMusicLoginQR)
			.mockResolvedValueOnce({ state: "waiting", account: null })
			.mockResolvedValueOnce({ state: "scanned", account: null })
			.mockResolvedValueOnce({ state: "confirmed", account: connectedAccount });
		const onSuccess = vi.fn();
		const onOpenChange = vi.fn();
		const { unmount } = render(
			<MusicLoginQrDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
			{ wrapper },
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(createMusicLoginQR).toHaveBeenCalledTimes(1);
		expect(checkMusicLoginQR).toHaveBeenCalledTimes(3);
		expect(onSuccess).toHaveBeenCalledExactlyOnceWith(connectedAccount);
		expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
		expect(queryClient.getQueryData(adminMusicKeys.account())).toEqual(connectedAccount);
		unmount();
		expect(cancelMusicLoginQR).not.toHaveBeenCalled();
	});

	it("扫码检查失败后停止轮询并允许显式重新生成二维码", async () => {
		vi.mocked(createMusicLoginQR)
			.mockResolvedValueOnce(challenge("failed"))
			.mockResolvedValueOnce(challenge("retry"));
		vi.mocked(checkMusicLoginQR).mockRejectedValueOnce(
			new ApiError({ error: "FORBIDDEN", message: "扫码会话已失效", status: 403 }),
		);
		render(<MusicLoginQrDialog open onOpenChange={vi.fn()} />, { wrapper });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(screen.getByRole("alert").textContent).toContain("扫码会话已失效");
		expect(checkMusicLoginQR).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(createMusicLoginQR).toHaveBeenCalledTimes(2);
		expect(vi.mocked(cancelMusicLoginQR).mock.calls.map(([id]) => id)).toEqual(["failed"]);
		expect(checkMusicLoginQR).toHaveBeenLastCalledWith("retry", expect.any(AbortSignal));
	});

	it("到期中止在途检查，迟到的确认结果不能更新账号或关闭弹窗", async () => {
		vi.mocked(createMusicLoginQR).mockResolvedValue(challenge("expires", 5_000));
		let resolveCheck: (value: { state: "confirmed"; account: MusicAccount }) => void = () => {
			throw new Error("检查请求未开始");
		};
		const pendingCheck = new Promise<{ state: "confirmed"; account: MusicAccount }>(
			(resolve) => {
				resolveCheck = resolve;
			},
		);
		let checkSignal: AbortSignal | undefined;
		vi.mocked(checkMusicLoginQR).mockImplementationOnce((_id, signal) => {
			checkSignal = signal;
			return pendingCheck;
		});
		const onSuccess = vi.fn();
		render(<MusicLoginQrDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />, {
			wrapper,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(6_000);
		});
		expect(checkSignal?.aborted).toBe(true);
		expect(screen.getByRole("button", { name: "刷新二维码" })).toBeDefined();
		await act(async () => {
			resolveCheck({ state: "confirmed", account: connectedAccount });
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(onSuccess).not.toHaveBeenCalled();
		expect(queryClient.getQueryData(adminMusicKeys.account())).toBeUndefined();
		expect(checkMusicLoginQR).toHaveBeenCalledTimes(1);
	});

	it("确认响应缺少账号时显示错误，不报告连接成功或继续轮询", async () => {
		vi.mocked(createMusicLoginQR).mockResolvedValue(challenge("missing-account"));
		vi.mocked(checkMusicLoginQR).mockResolvedValue({ state: "confirmed", account: null });
		const onSuccess = vi.fn();
		render(<MusicLoginQrDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />, {
			wrapper,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(screen.getByRole("alert")).toBeDefined();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(checkMusicLoginQR).toHaveBeenCalledTimes(1);
	});
});
