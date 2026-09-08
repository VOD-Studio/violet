import type { PublicPersona } from "@entities/persona/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { activePersonaQuery, imagePreviewProps, localeChange } = vi.hoisted(() => ({
	activePersonaQuery: {} as {
		data: PublicPersona | null;
		isPending: boolean;
		isError: boolean;
		isPlaceholderData?: boolean;
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
		return props.open ? <div data-testid="persona-lightbox" /> : null;
	},
}));

vi.mock("@shared/ui/image-pixel-reveal", () => ({
	ImagePixelReveal: (props: { src: string; alt?: string }) => (
		<img data-testid="hero-reveal" src={props.src} alt={props.alt} />
	),
}));

import { PersonaPage } from "../PersonaPage";

const persona: PublicPersona = {
	locale: "zh-CN",
	default_locale: "zh-CN",
	available_locales: ["zh-CN", "ja-JP"],
	avatar: {
		url: "/avatar.png",
		thumbnail: "/avatar-thumb.png",
		width: 512,
		height: 512,
		alt_text: "若菫瑠爱头像",
	},
	name: "若菫瑠爱｜RUA",
	subtitle: "20 岁 · 信息设计专业",
	summary: "她习惯在表达之前先认真想清楚。",
	content_html: "<h2>人物锚点</h2><p>练习及时表达。</p>",
	facts: [
		{ label: "年龄", value: "20 岁" },
		{ label: "生日", value: "4 月 12 日" },
	],
	images: [
		{
			url: "/hero.png",
			thumbnail: "/hero-thumb.png",
			width: 1024,
			height: 768,
			alt_text: "若菫瑠爱主设定",
			caption: "角色主设定",
		},
		{
			url: "/reference.png",
			thumbnail: "/reference-thumb.png",
			width: 2048,
			height: 1152,
			alt_text: "角色三视图",
			caption: "",
		},
	],
};

describe("PersonaPage", () => {
	beforeEach(() => {
		activePersonaQuery.data = null;
		activePersonaQuery.isPending = false;
		activePersonaQuery.isError = false;
		activePersonaQuery.isPlaceholderData = false;
		imagePreviewProps.mockReset();
		localeChange.mockReset();
	});

	it("没有当前人设时诚实展示未公开状态", () => {
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		expect(screen.getByRole("heading", { name: "人设档案尚未公开" })).toBeTruthy();
		expect(screen.getByText("当前没有已激活的角色资料。")).toBeTruthy();
	});

	it("按画报排版展示肖像、档案资料、交错设定展板与长文", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		expect(screen.getByRole("heading", { name: persona.name })).toBeTruthy();

		// 肖像卡片
		const hero = screen.getByTestId("hero-reveal");
		expect(hero.getAttribute("alt")).toBe("若菫瑠爱头像");
		expect(hero.getAttribute("src")).toContain("960");

		// 档案资料
		expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
			"年龄",
			"生日",
		]);
		expect(screen.getByText("20 岁")).toBeTruthy();

		// 长文设定
		expect(screen.getByTestId("persona-content").textContent).toContain("练习及时表达");

		// 默认折叠为堆叠，点击展开后呈现交错大展板
		fireEvent.click(screen.getByRole("button", { name: /展开全部/ }));
		expect(screen.getByRole("button", { name: "预览 角色三视图" })).toBeTruthy();
		expect(screen.getByText("角色主设定")).toBeTruthy();
	});

	it("直接展示已配置语言胶囊并提交语言切换", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		fireEvent.click(screen.getByRole("button", { name: "日本語" }));

		expect(localeChange).toHaveBeenCalledWith("ja-JP", "zh-CN");
	});

	it("展开画廊展板后点击打开完整有序灯箱", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		fireEvent.click(screen.getByRole("button", { name: /展开全部/ }));
		fireEvent.click(screen.getByRole("button", { name: "预览 角色三视图" }));
		expect(screen.getByTestId("persona-lightbox")).toBeTruthy();
		expect(imagePreviewProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				open: true,
				currentIndex: 2,
				images: ["/avatar.png", "/hero.png", "/reference.png"],
				thumbnails: ["/avatar-thumb.png", "/hero-thumb.png", "/reference-thumb.png"],
				alts: ["若菫瑠爱头像", "若菫瑠爱主设定", "角色三视图"],
			}),
		);
	});

	it("从头像打开灯箱并映射为第一张图", () => {
		activePersonaQuery.data = persona;
		render(<PersonaPage locale="" onLocaleChange={localeChange} />);

		fireEvent.click(screen.getByRole("button", { name: "预览 若菫瑠爱头像" }));

		expect(imagePreviewProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ open: true, currentIndex: 0 }),
		);
	});
});
