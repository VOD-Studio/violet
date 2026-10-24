import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleImage } from "../components/ArticleImage";

afterEach(cleanup);

describe("ArticleImage", () => {
	it("保留正文图片尺寸与原生加载语义", () => {
		const { getByAltText } = render(
			<ArticleImage
				src="/uploads/a.png"
				alt="透明图"
				title="原始说明"
				width={800}
				height={400}
			/>,
		);
		const image = getByAltText("透明图");
		expect(image.getAttribute("width")).toBe("800");
		expect(image.getAttribute("height")).toBe("400");
		expect(image.getAttribute("title")).toBe("原始说明");
		expect(image.getAttribute("loading")).toBe("lazy");
		expect(image.getAttribute("decoding")).toBe("async");
		expect(image.style.minHeight).toBe("");
	});

	it("未知尺寸只保留最小空间，加载后释放且不裁剪或伪造比例", () => {
		const { getByAltText } = render(<ArticleImage src="/uploads/a.png" alt="未知尺寸" />);
		const image = getByAltText("未知尺寸");
		expect(image.hasAttribute("width")).toBe(false);
		expect(image.hasAttribute("height")).toBe(false);
		expect(image.style.aspectRatio).toBe("");
		expect(image.hasAttribute("sizes")).toBe(false);
		expect(image.hasAttribute("srcset")).toBe(false);
		const sources = image.parentElement?.querySelectorAll("source");
		expect(sources?.length).toBeGreaterThan(0);
		for (const source of sources ?? []) {
			expect(source.srcset).not.toMatch(/\s\d+(?:w|x)(?:,|$)/);
		}
		expect(image.style.minHeight).toBe("96px");
		expect(image.style.objectFit).toBe("contain");
		fireEvent.load(image);
		expect(image.style.minHeight).toBe("");
	});

	it("外链原地址和作者候选不变，GIF 不转成静态候选", () => {
		const src = "https://images.example/a.png?w=100&quality=95";
		const { getByAltText } = render(
			<>
				<ArticleImage src={src} srcSet="https://images.example/a@2x.png 2x" alt="外链" />
				<ArticleImage src="/uploads/animated.gif" alt="动图" />
			</>,
		);
		expect(getByAltText("外链").getAttribute("src")).toBe(src);
		expect(getByAltText("外链").getAttribute("srcset")).toBe(
			"https://images.example/a@2x.png 2x",
		);
		expect(getByAltText("动图").getAttribute("src")).toBe("/uploads/animated.gif");
		expect(getByAltText("动图").hasAttribute("srcset")).toBe(false);
		expect(getByAltText("动图").hasAttribute("sizes")).toBe(false);
		expect(getByAltText("外链").hasAttribute("sizes")).toBe(false);
	});
});
