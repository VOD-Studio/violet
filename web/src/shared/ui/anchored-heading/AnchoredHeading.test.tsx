import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnchoredHeading } from "./AnchoredHeading";

const originalUrl = window.location.href;
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
	window.history.replaceState(null, "", "/design-system/palette?theme=violet");
	Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	writeText.mockClear();
});

afterEach(() => {
	window.history.replaceState(null, "", originalUrl);
	if (originalSecureContext)
		Object.defineProperty(window, "isSecureContext", originalSecureContext);
	else Reflect.deleteProperty(window, "isSecureContext");
	if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
	else Reflect.deleteProperty(navigator, "clipboard");
	if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
	else Reflect.deleteProperty(document, "execCommand");
	vi.restoreAllMocks();
});

describe("AnchoredHeading", () => {
	it("copies a direct URL with the current path and query without navigating away", async () => {
		render(
			<AnchoredHeading id="如何使用颜色" copyLabel="复制颜色章节链接">
				如何使用颜色
			</AnchoredHeading>,
		);
		const beforeClick = window.location.href;
		const expected = new URL(beforeClick);
		expected.hash = "如何使用颜色";
		fireEvent.click(screen.getByRole("button", { name: "复制颜色章节链接" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected.href));
		expect(window.location.href).toBe(beforeClick);
	});

	it("shows a temporary success state and resets the timer after repeated copies", async () => {
		vi.useFakeTimers();
		try {
			render(<AnchoredHeading id="主色">主色</AnchoredHeading>);
			const button = screen.getByRole("button", { name: "复制此章节链接" });
			await act(async () => {
				fireEvent.click(button);
				await Promise.resolve();
			});
			expect(button.getAttribute("title")).toBe("已复制章节链接");
			expect(button.dataset.copied).toBe("true");

			await act(() => vi.advanceTimersByTime(1500));
			await act(async () => {
				fireEvent.click(button);
				await Promise.resolve();
			});
			expect(writeText).toHaveBeenCalledTimes(2);
			await act(() => vi.advanceTimersByTime(600));
			expect(button.getAttribute("aria-label")).toBe("已复制章节链接");
			await act(() => vi.advanceTimersByTime(1400));
			expect(button.getAttribute("aria-label")).toBe("复制此章节链接");
			expect(button.dataset.copied).toBe("false");
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps the copy affordance on clipboard failure", async () => {
		const errorToast = vi.spyOn(toast, "error").mockImplementation(() => "");
		writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
		Object.defineProperty(document, "execCommand", {
			configurable: true,
			value: vi.fn().mockReturnValue(false),
		});
		render(<AnchoredHeading id="主色">主色</AnchoredHeading>);
		const button = screen.getByRole("button", { name: "复制此章节链接" });
		fireEvent.click(button);
		await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
		await waitFor(() => expect(errorToast).toHaveBeenCalledWith("复制链接失败"));
		expect(button.getAttribute("aria-label")).toBe("复制此章节链接");
		expect(button.dataset.copied).toBe("false");
	});
});
