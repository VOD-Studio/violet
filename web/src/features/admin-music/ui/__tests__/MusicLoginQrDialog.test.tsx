import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicLoginQrDialog } from "../MusicLoginQrDialog";

const mockCreateMutateAsync = vi.fn();
const mockCancelMutate = vi.fn();

vi.mock("../../api/queries", () => ({
	useCreateMusicLoginQR: () => ({
		mutateAsync: mockCreateMutateAsync,
		isPending: false,
	}),
	useCancelMusicLoginQR: () => ({
		mutate: mockCancelMutate,
	}),
	useMusicQrPolling: () => ({
		qrState: "waiting",
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("MusicLoginQrDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("打开对话框时发起二维码挑战", async () => {
		mockCreateMutateAsync.mockResolvedValueOnce({
			id: "ch-100",
			url: "https://music.163.com/login?codekey=mock123",
			expires_at: "2026-10-21T12:00:00Z",
		});

		render(<MusicLoginQrDialog open={true} onOpenChange={vi.fn()} />);

		expect(screen.getByText("扫码连接网易云账号")).toBeDefined();
		expect(mockCreateMutateAsync).toHaveBeenCalled();
	});
});
