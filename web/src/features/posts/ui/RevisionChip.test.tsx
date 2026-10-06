import type { PostDetail } from "@entities/post/model/types";
import { RevisionChip } from "@features/posts/ui/RevisionChip";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
	it("悬停修订标记时打开修订面板", () => {
		const post = mockPost({
			published_at: "2026-08-15T08:00:00Z",
			edited_at: "2026-08-20T14:30:00Z",
			edited_version_count: 3,
		});
		render(<RevisionChip post={post} />);

		expect(screen.queryByRole("dialog")).toBeNull();
		fireEvent.mouseEnter(screen.getByRole("button"));
		expect(screen.getByRole("dialog")).toBeDefined();
	});

	it("无 edited_at 时安全返回 null 不渲染", () => {
		const post = mockPost({ edited_at: undefined });
		const { container } = render(<RevisionChip post={post} />);
		expect(container.firstChild).toBeNull();
	});
});
