import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnchoredHeading } from "./AnchoredHeading";

const originalUrl = window.location.href;
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
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
});
