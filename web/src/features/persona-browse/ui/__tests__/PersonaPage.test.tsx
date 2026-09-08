import type { PublicPersona } from "@entities/persona/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { activePersonaQuery, imagePreviewProps, localeChange } = vi.hoisted(() => ({
	activePersonaQuery: {
		data: null as PublicPersona | null,
		isLoading: false,
		isError: false,
	},
	imagePreviewProps: vi.fn(),
	localeChange: vi.fn(),
}));

vi.mock("@entities/persona/api/queries", () => ({
	useActivePersona: () => activePersonaQuery,
}));

vi.mock("@shared/hooks/use-article-image-preview", () => ({
	useArticleImagePreview: () => ({
		bind: { onClick: vi.fn(), onKeyDown: vi.fn() },
		preview: null,
	}),
}));

vi.mock("@shared/ui/markdown-preview/ArticleContent", () => ({
	default: ({ content }: { content: string }) => (
		<div data-testid="persona-content">{content}</div>
	),
}));

vi.mock("@shared/ui/image-preview", () => ({
	ImagePreview: (props: { open: boolean; currentIndex: number }) => {
		imagePreviewProps(props);
		return props.open ? (
			<div role="dialog" aria-label="图片预览">
				图片预览
			</div>
		) : null;
	},
}));

import { PersonaPage } from "../PersonaPage";

const persona: PublicPersona = {
	locale: "zh-CN",
	default_locale: "zh-CN",
	available_locales: ["zh-CN", "ja-JP"],
	avatar: {
		url: "/avatar.png",
		thumbnail: "/avatar-thumb.png",
		width: 640,
		height: 640,
		alt_text: "若菫瑠爱头像",
	},
	name: "若菫瑠爱｜RUA",
	subtitle: "20 岁 · 信息设计专业",
	summary: "她习惯在表达之前先认真想清楚。",
	content_html: "<h2>人物锚点</h2><p>练习及时表达。</p>",
	facts: [
		{ label: "年龄", value: "20 岁" },
		{ label: "生日", value: "11 月 17 日" },
	],
	images: [
		{
			url: "/hero.png",
			thumbnail: "/hero-thumb.png",
			width: 1200,
			height: 1200,
			caption: "月光茶会头像",
			alt_text: "若菫瑠爱头像",
		},
		{
			url: "/reference.png",
			thumbnail: "/reference-thumb.png",
			width: 1536,
			height: 1024,
			caption: "角色主设定",
			alt_text: "角色三视图",
		},
	],
};

describe("PersonaPage", () => {
	beforeEach(() => {
		activePersonaQuery.data = null;
		activePersonaQuery.isLoading = false;
		activePersonaQuery.isError = false;
		imagePreviewProps.mockReset();
		localeChange.mockReset();
	});

	it("没有当前人设时诚实展示未公开状态", () => {
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		expect(screen.getByRole("heading", { name: "人设档案尚未公开" })).toBeTruthy();
		expect(screen.getByText("当前没有已激活的角色资料。")).toBeTruthy();
	});

	it("按服务端顺序展示主视觉、资料、正文与设定图", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		expect(screen.getByRole("heading", { name: persona.name })).toBeTruthy();
		expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
			"年龄",
			"生日",
		]);
		expect(screen.getByTestId("persona-content").textContent).toContain("练习及时表达");

		const images = screen.getAllByRole("img");
		expect(images.map((image) => image.getAttribute("alt"))).toEqual([
			"若菫瑠爱头像",
			"若菫瑠爱头像",
			"角色三视图",
		]);
		expect(images[0]?.getAttribute("loading")).toBe("eager");
		expect(images[1]?.getAttribute("loading")).toBe("lazy");
		expect(images[0]?.getAttribute("srcset")).toContain("320w");
		expect(images[0]?.getAttribute("srcset")).toContain("960w");
		expect(images[0]?.getAttribute("sizes")).toContain("24rem");
		expect(screen.getByText("角色主设定")).toBeTruthy();
	});

	it("直接展示已配置语言并提交语言切换", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		fireEvent.click(screen.getByRole("button", { name: "日本語" }));

		expect(localeChange).toHaveBeenCalledWith("ja-JP", "zh-CN");
	});

	it("从任意设定图打开完整有序灯箱", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		fireEvent.click(screen.getByRole("button", { name: "预览 角色三视图" }));

		expect(screen.getByRole("dialog", { name: "图片预览" })).toBeTruthy();
		expect(imagePreviewProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				open: true,
				currentIndex: 2,
				images: ["/avatar.png", "/hero.png", "/reference.png"],
				thumbnails: ["/avatar-thumb.png", "/hero-thumb.png", "/reference-thumb.png"],
				alts: ["若菫瑠爱头像", "若菫瑠爱头像", "角色三视图"],
			}),
		);
	});
});
