import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageGrid } from "../image-grid";

const images = Array.from({ length: 9 }, (_, index) => ({
	src: `/thumb-${index}.jpg`,
	alt: `风景 ${index + 1}`,
}));
afterEach(cleanup);

describe("ImageGrid", () => {
	it.each([1, 2, 3, 4, 5, 9])("%i 张只显示前四张，按钮仍表达完整数量", (count) => {
		const open = vi.fn();
		render(<ImageGrid images={images.slice(0, count)} onImageClick={open} />);
		expect(screen.getAllByRole("button")).toHaveLength(Math.min(count, 4));
		expect(screen.getAllByRole("img")).toHaveLength(Math.min(count, 4));
		const last = Math.min(count, 4) - 1;
		const button = screen.getByRole("button", {
			name: `查看第 ${last + 1} 张，共 ${count} 张`,
		});
		const thumbnail = button.querySelector("img");
		fireEvent.click(button);
		expect(open).toHaveBeenCalledWith(last, thumbnail);
		expect(thumbnail).toBeInstanceOf(HTMLImageElement);
		if (count > 4) expect(screen.getByText(`+${count - 3}`)).toBeTruthy();
		else expect(screen.queryByText(/^\+/)).toBeNull();
	});

	it("未知尺寸的单图按加载后的原始比例，超宽图限制到 16:9", () => {
		const { rerender } = render(<ImageGrid images={[images[0]]} onImageClick={() => {}} />);
		const img = screen.getByRole("img");
		Object.defineProperties(img, {
			naturalWidth: { value: 200 },
			naturalHeight: { value: 400 },
		});
		fireEvent.load(img);
		expect(img.parentElement?.style.getPropertyValue("--v-image-grid-ratio")).toBe("0.5");
		rerender(
			<ImageGrid
				images={[{ src: "/wide.jpg", alt: "全景", width: 4000, height: 1000 }]}
				onImageClick={() => {}}
			/>,
		);
		expect(
			screen.getByRole("img").parentElement?.style.getPropertyValue("--v-image-grid-ratio"),
		).toBe(String(16 / 9));
	});

	it("保留根节点属性与 ref，网格按钮不提交宿主表单且允许宿主取消点击", () => {
		const ref = createRef<HTMLDivElement>();
		const open = vi.fn();
		const submit = vi.fn();
		render(
			<form onSubmit={submit}>
				<ImageGrid
					ref={ref}
					aria-label="旅行照片"
					images={[images[0]]}
					onImageClick={open}
					onClickCapture={(event) => event.stopPropagation()}
				/>
			</form>,
		);
		expect(ref.current?.getAttribute("aria-label")).toBe("旅行照片");
		fireEvent.click(screen.getByRole("button"));
		expect(open).not.toHaveBeenCalled();
		expect(submit).not.toHaveBeenCalled();
	});

	it("无图不留空容器", () => {
		const { container } = render(<ImageGrid images={[]} onImageClick={() => {}} />);
		expect(container.firstChild).toBeNull();
	});
});
