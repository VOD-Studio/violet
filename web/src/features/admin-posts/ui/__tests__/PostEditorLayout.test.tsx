/**
 * PostEditor 布局回归测试
 *
 * 场景：正文出现很长且不可换行的内容时，左侧编辑区不应撑开，
 * 避免右侧面板被挤压。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const existing = {
	id: "p1",
	slug: "hello-world",
	title: "示例文章",
	content_html: `<pre><code>${"a".repeat(5000)}</code></pre>`,
	content_md: "",
	excerpt: "",
	cover_image: "",
	seo_title: "",
	seo_description: "",
	tags: [] as string[],
	is_featured: false,
};

vi.mock("@features/editor", async () => {
	const React = await import("react");
	return {
		RichTextEditor: React.forwardRef<unknown, { value: string }>((props, _ref) => {
			return <div data-testid="rich-text-editor">{props.value.length}</div>;
		}),
	};
});

vi.mock("@features/admin-posts/api/queries", () => ({
	useAdminPost: () => ({ data: existing, isLoading: false }),
	usePostVersions: () => ({ data: [], isLoading: false }),
	fetchAdminPost: () => Promise.resolve(existing),
}));
vi.mock("@features/admin-posts/api/mutations", () => ({
	useCreatePost: () => ({ mutate: () => {}, isPending: false }),
	useUpdatePost: () => ({ mutate: () => {}, isPending: false }),
	publishPost: () => Promise.resolve(),
	importPostUrl: () => Promise.resolve({ html: "" }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		fetchQuery: () => Promise.resolve(existing),
		invalidateQueries: () => {},
	}),
}));
vi.mock("@features/admin-posts/ui/PostEditorSidebar", () => ({
	PostEditorSidebar: () => <div data-testid="post-editor-sidebar">Sidebar</div>,
}));
vi.mock("@features/admin-posts/ui/PostEditorToolbar", () => ({
	PostEditorToolbar: () => <div data-testid="post-editor-toolbar">Toolbar</div>,
}));
vi.mock("@features/admin-posts/ui/PostVersionsSheet", () => ({
	PostVersionsSheet: () => null,
}));
vi.mock("@entities/media/ui/MediaPicker", () => ({
	MediaPicker: () => null,
}));

import { PostEditor } from "@features/admin-posts/ui/PostEditor";

describe("PostEditor 布局", () => {
	it("编辑区容器应限制最小宽度，防止长内容撑开并挤压侧边栏", () => {
		render(<PostEditor postId="p1" />);

		const editorWorkspace = screen.getByTestId("editor-workspace");
		expect(editorWorkspace.classList.contains("min-w-0")).toBe(true);
	});
});
