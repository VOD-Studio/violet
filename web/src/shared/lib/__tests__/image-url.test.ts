import { SITE_URL } from "@shared/config/env";
import { describe, expect, it } from "vitest";
import {
	avatarUrl,
	contentImageSources,
	contentImageUrl,
	imageUrl,
	originalImageUrl,
} from "../image-url";

describe("avatarUrl", () => {
	it("空 path 返回默认头像", () => {
		expect(avatarUrl("", "alice")).toContain("ui-avatars.com");
	});

	it("undefined path 返回默认头像", () => {
		expect(avatarUrl(undefined as unknown as string, "alice")).toContain("ui-avatars.com");
	});

	it("静态图追加 w/thumb/format 参数", () => {
		const u = avatarUrl("/uploads/avatar/x.webp", "alice");
		expect(u).toContain("w=200");
		expect(u).toContain("thumb=200x200");
		expect(u).toContain("format=webp");
	});

	it("GIF 剥除所有处理参数保护动画", () => {
		const u = avatarUrl("/uploads/avatar/a.gif", "alice");
		expect(u).toBe("/uploads/avatar/a.gif");
		expect(u).not.toContain("format=webp");
		expect(u).not.toContain("w=200");
		expect(u).not.toContain("thumb");
	});

	it("GIF path 已有 crop 参数保留", () => {
		const u = avatarUrl("/uploads/avatar/a.gif?crop=0.1,0.2,0.5,0.5", "alice");
		expect(u).toContain("crop=0.1,0.2,0.5,0.5");
		expect(u).not.toContain("format=webp");
	});

	it("GIF 大写后缀也识别", () => {
		const u = avatarUrl("/uploads/avatar/a.GIF", "alice");
		expect(u).toBe("/uploads/avatar/a.GIF");
		expect(u).not.toContain("format=webp");
	});
});

describe("imageUrl 合并已有查询参数", () => {
	it("path 已带 crop 时合并而非追加第二个问号", () => {
		const u = imageUrl("/uploads/a.jpg?crop=0.1,0.2,0.5,0.5", { w: 800, format: "webp" });
		expect(u.startsWith("/uploads/a.jpg?")).toBe(true);
		expect(u.indexOf("?")).toBe(u.lastIndexOf("?"));
		expect(u).toContain("w=800");
		expect(u).toContain("format=webp");
		// crop 经 URLSearchParams 往返不丢失(parseCrop 解码 %2C 与逗号等价)
		expect(decodeURIComponent(u)).toContain("crop=0.1,0.2,0.5,0.5");
	});

	it("无参数时原样返回(不引入问号)", () => {
		expect(imageUrl("/uploads/a.jpg", {})).toBe("/uploads/a.jpg");
	});

	it("重复调用幂等(覆盖同名参数)", () => {
		const once = imageUrl("/uploads/a.jpg", { w: 800 });
		const twice = imageUrl(once, { w: 1200 });
		expect(twice).toBe("/uploads/a.jpg?w=1200");
	});
});

describe("contentImageUrl", () => {
	it("静态图走 w 档 + webp", () => {
		expect(contentImageUrl("/uploads/a.jpg", { width: 1200 })).toBe(
			"/uploads/a.jpg?w=1200&format=webp&quality=80",
		);
	});

	it("GIF 剥参数保护动画(crop 保留)", () => {
		const u = contentImageUrl("/uploads/a.gif?crop=0.1,0.2,0.5,0.5", { width: 1200 });
		expect(u).toBe("/uploads/a.gif?crop=0.1,0.2,0.5,0.5");
	});

	it("已带 crop 的静态图合并参数", () => {
		const u = contentImageUrl("/uploads/a.jpg?crop=0.1,0.2,0.5,0.5", { width: 800 });
		expect(u.indexOf("?")).toBe(u.lastIndexOf("?"));
		expect(u).toContain("w=800");
		expect(decodeURIComponent(u)).toContain("crop=0.1,0.2,0.5,0.5");
	});

	it("展示图移除旧 thumb/h，但保留作者 crop", () => {
		const url = contentImageUrl("/uploads/a.png?thumb=200x200&h=200&crop=0.1,0.2,0.5,0.5", {
			width: 920,
		});
		const params = new URL(url, SITE_URL).searchParams;
		expect(params.get("thumb")).toBeNull();
		expect(params.get("h")).toBeNull();
		expect(params.get("crop")).toBe("0.1,0.2,0.5,0.5");
		expect(params.get("quality")).toBe("80");
	});

	it("本站绝对地址可缩放，外链和数据地址不套用本站编码协议", () => {
		expect(contentImageUrl(`${SITE_URL}/uploads/a.png`, { width: 360 })).toBe(
			`${SITE_URL}/uploads/a.png?w=360&format=webp&quality=80`,
		);
		for (const src of [
			"https://external.example/uploads/a.png?w=200&quality=95",
			"//external.example/uploads/a.png",
			"data:image/png;base64,abc",
		]) {
			expect(contentImageUrl(src, { width: 360 })).toBe(src);
			expect(contentImageSources(src, [360, 720])).toEqual([]);
			expect(originalImageUrl(src)).toBe(src);
		}
	});

	it("已带转换参数的 GIF 还原原图，避免动画变成静态首帧", () => {
		expect(contentImageUrl("/uploads/a.gif?w=920&format=webp&quality=80", { width: 360 })).toBe(
			"/uploads/a.gif",
		);
	});
});

describe("contentImageSources", () => {
	it("候选按视口和 DPR 选择，但不谎报后端实际输出宽度", () => {
		const sources = contentImageSources("/uploads/a.jpg", [360, 720, 1200], 600);
		expect(sources[0]).toEqual({
			media: expect.stringContaining("(max-resolution: 1dppx) and (max-width: 360px)"),
			srcSet: "/uploads/a.jpg?w=360&format=webp&quality=80",
		});
		expect(sources[1]).toEqual({
			media: expect.stringContaining("(max-resolution: 1dppx)"),
			srcSet: "/uploads/a.jpg?w=720&format=webp&quality=80",
		});
		for (const source of sources) {
			expect(source.srcSet).not.toMatch(/\s\d+(?:w|x)(?:,|$)/);
		}
	});

	it("GIF 不生成无法区分的重复候选", () => {
		expect(contentImageSources("/uploads/a.gif", [640, 1024])).toEqual([]);
	});

	it("请求档位超过接口上限时钳制并去重", () => {
		const sources = contentImageSources("/uploads/a.png", [4096, 8192]);
		expect(sources).toHaveLength(1);
		expect(sources.every((source) => source.srcSet.includes("w=4096&"))).toBe(true);
	});
});

describe("originalImageUrl", () => {
	it("剥离全部处理参数还原原图", () => {
		expect(originalImageUrl("/uploads/a.jpg?w=1200&format=webp")).toBe("/uploads/a.jpg");
		expect(
			originalImageUrl(
				"/uploads/a.jpg?w=600&thumb=300x300&format=webp&quality=70&rotate=90&h=300",
			),
		).toBe("/uploads/a.jpg");
	});

	it("保留 crop 等前端参数", () => {
		const u = originalImageUrl("/uploads/a.jpg?crop=0.1,0.2,0.5,0.5&w=1200&format=webp");
		expect(u.startsWith("/uploads/a.jpg?")).toBe(true);
		expect(u).not.toContain("w=1200");
		expect(decodeURIComponent(u)).toContain("crop=0.1,0.2,0.5,0.5");
	});

	it("无参数原样返回", () => {
		expect(originalImageUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg");
	});

	it("与原图组合往返:contentImageUrl → originalImageUrl = 原图", () => {
		const origin = "/uploads/a.jpg?crop=0.1,0.2,0.5,0.5";
		const round = originalImageUrl(contentImageUrl(origin, { width: 1200 }));
		expect(decodeURIComponent(round)).toBe(origin);
	});
});
