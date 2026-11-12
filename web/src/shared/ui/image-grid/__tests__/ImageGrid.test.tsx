import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageGrid } from "../ImageGrid";

vi.mock("@shared/ui/image-preview", async () => ({
	...(await vi.importActual("@shared/ui/image-preview/hooks/useImagePreview")),
	ImagePreview: ({
		open,
		images,
		currentIndex,
		triggerElement,
		onIndexChange,
		onClose,
	}: {
		open: boolean;
		images: string[];
		currentIndex: number;
		triggerElement: HTMLElement | null;
		onIndexChange: (index: number) => void;
		onClose: () => void;
	}) =>
		open ? (
			<div role="dialog" aria-label="图片预览" data-trigger={triggerElement?.tagName}>
				<img src={images[currentIndex]} alt="完整图片" />
				<button type="button" onClick={() => onIndexChange(currentIndex + 1)}>
					下一张
				</button>
				<button type="button" onClick={onClose}>
					关闭
				</button>
			</div>
		) : null,
}));

afterEach(cleanup);

describe("本站图片网格灯箱编排", () => {
	it("第四格从真实缩略图打开原图，隐藏图片仍可在灯箱顺序浏览", () => {
		const images = Array.from({ length: 6 }, (_, index) => ({
			url: `/full-${index}.jpg`,
			thumbnail: `/thumb-${index}.jpg`,
		}));
		render(<ImageGrid images={images} />);
		expect(screen.getAllByRole("button")).toHaveLength(4);
		const fourth = screen.getByRole("button", { name: "查看第 4 张，共 6 张" });
		expect(fourth.querySelector("img")?.getAttribute("src")).toBe("/thumb-3.jpg");
		fireEvent.click(screen.getByText("+3"));
		expect(screen.getByRole("dialog").getAttribute("data-trigger")).toBe("IMG");
		expect(screen.getByAltText("完整图片").getAttribute("src")).toBe("/full-3.jpg");
		fireEvent.click(screen.getByRole("button", { name: "下一张" }));
		expect(screen.getByAltText("完整图片").getAttribute("src")).toBe("/full-4.jpg");
		fireEvent.click(screen.getByRole("button", { name: "关闭" }));
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
