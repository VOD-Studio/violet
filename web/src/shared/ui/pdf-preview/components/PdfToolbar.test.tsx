import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfToolbar } from "./PdfToolbar";

const handlers = {
	onPrevPage: vi.fn(),
	onNextPage: vi.fn(),
	onGoToPage: vi.fn(),
	onZoomIn: vi.fn(),
	onZoomOut: vi.fn(),
	onResetZoom: vi.fn(),
	onDownload: vi.fn(),
};

describe("PdfToolbar", () => {
	it("嵌入统一查看器时可以隐藏重复下载操作", () => {
		const { rerender } = render(
			<PdfToolbar currentPage={1} numPages={2} scale={1} {...handlers} />,
		);
		expect(screen.getByTitle("下载 PDF")).toBeTruthy();

		rerender(
			<PdfToolbar
				currentPage={1}
				numPages={2}
				scale={1}
				showDownload={false}
				{...handlers}
			/>,
		);
		expect(screen.queryByTitle("下载 PDF")).toBeNull();
	});
});
