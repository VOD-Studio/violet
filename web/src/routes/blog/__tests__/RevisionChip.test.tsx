import type { PostDetail } from "@entities/post/model/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevisionChip } from "../$slug";

function mockPost(overrides: Partial<PostDetail> = {}): PostDetail {
	return {
		id: "post-1",
		slug: "test-post",
		title: "测试文章",
		content_md: "文章内容",
		content_html: "<p>文章内容</p>",
		excerpt: "摘要",
		cover_image: "",
		status: "published",
		author_id: "u-1",
		view_count: 42,
		is_featured: false,
		show_signature: false,
		seo_title: "",
		seo_description: "",
		tags: ["test"],
		published_at: "2026-08-15T08:00:00Z",
		edited_at: "2026-08-20T14:30:00Z",
		edited_version_count: 3,
		created_at: "2026-08-15T07:00:00Z",
		updated_at: "2026-08-20T14:30:00Z",
		...overrides,
	};
}

describe("RevisionChip", () => {
	it("作为日期后缀时渲染简洁的 (已编辑) 标记", () => {
		const post = mockPost({
			edited_at: "2026-08-20T14:30:00Z",
			edited_version_count: 3,
		});
		render(<RevisionChip post={post} />);

		expect(screen.getByText("(已编辑)")).toBeDefined();
	});

	it("hover 时通过 Popover 呈现精简真实的修订事实", () => {
		const post = mockPost({
			published_at: "2026-08-15T08:00:00Z",
			edited_at: "2026-08-20T14:30:00Z",
			edited_version_count: 3,
		});
		render(<RevisionChip post={post} />);

		const trigger = screen.getByText("(已编辑)");
		fireEvent.mouseEnter(trigger);

		expect(screen.getByText("修订记录")).toBeDefined();
		expect(screen.getByText("共 3 次")).toBeDefined();
		expect(screen.getByText("首次发布")).toBeDefined();
		expect(screen.getByText("2026年8月15日")).toBeDefined();
		expect(screen.getByText("最近编辑")).toBeDefined();
		expect(screen.getByText("2026年8月20日")).toBeDefined();
	});

	it("standalone 模式独立渲染编辑日期文案", () => {
		const post = mockPost({
			edited_at: "2026-08-20T14:30:00Z",
			edited_version_count: 2,
		});
		render(<RevisionChip post={post} standalone />);

		expect(screen.getByText("编辑于 2026年8月20日")).toBeDefined();
	});

	it("无 edited_at 时安全返回 null 不渲染", () => {
		const post = mockPost({ edited_at: undefined });
		const { container } = render(<RevisionChip post={post} />);
		expect(container.firstChild).toBeNull();
	});
});
