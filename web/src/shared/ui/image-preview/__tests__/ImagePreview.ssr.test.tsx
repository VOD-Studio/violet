import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

// @vitest-environment node

describe("ImagePreview SSR 安全", () => {
	it("服务端不输出依赖浏览器尺寸的预览层", () => {
		expect(
			renderToString(
				<ImagePreview
					open
					onClose={() => {}}
					images={["/img1.jpg", "/img2.jpg"]}
					thumbnails={["/thumb1.jpg", "/thumb2.jpg"]}
					currentIndex={0}
				/>,
			),
		).toBe("");
	});
});
