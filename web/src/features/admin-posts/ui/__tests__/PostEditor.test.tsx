/**
 * PostEditor 编辑态预填回归测试
 *
 * 核心场景：RichTextEditor 的 value 契约是 HTML，保留颜色/对齐。编辑已有文章时，
 * 预填必须取 existing.content_html；若误用 content_md 这一 lossy Markdown 源码，
 * 会被 contentType:"html" 当 HTML 解析，Markdown 符号裸露成纯文本、格式丢失。
 */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// capturedValues 与 existing 需在 vi.mock factory 中引用，故用 hoisted 提前初始化
const { capturedValues, existing } = vi.hoisted(() => ({
    capturedValues: [] as string[],
    // 编辑态样例文章：content_html 为渲染权威源，content_md 为 lossy Markdown 源码，两者刻意不同
    existing: {
        id: "p1",
        slug: "hello-world",
        title: "示例文章",
        content_html: "<h1>标题</h1><p>正文<strong>加粗</strong></p>",
        content_md: "# 标题\n\n正文**加粗**",
        excerpt: "",
        cover_image: "",
        seo_title: "",
        seo_description: "",
        tags: [] as string[],
        is_featured: false,
    },
}));

// RichTextEditor：仅捕获收到的 value，转发 ref 以避免告警
vi.mock("@features/editor", async () => {
    const React = await import("react");
    return {
        RichTextEditor: React.forwardRef<unknown, { value: string }>((props, _ref) => {
            capturedValues.push(props.value);
            return null;
        }),
    };
});

// 数据层：编辑态返回样例文章
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

// 切断子组件依赖链，避免拖入 @entities 值导入与无关渲染
vi.mock("@features/admin-posts/ui/PostEditorSidebar", () => ({ PostEditorSidebar: () => null }));
vi.mock("@features/admin-posts/ui/PostEditorToolbar", () => ({ PostEditorToolbar: () => null }));
vi.mock("@features/admin-posts/ui/PostVersionsSheet", () => ({ PostVersionsSheet: () => null }));
vi.mock("@features/admin-media/ui/MediaPicker", () => ({ MediaPicker: () => null }));

import { PostEditor } from "@features/admin-posts/ui/PostEditor";

describe("PostEditor 编辑态预填", () => {
    it("编辑已有文章时喂给编辑器的是 HTML（content_html）而非 Markdown（content_md）", async () => {
        render(<PostEditor postId="p1" />);

        // 等预填生效：编辑器捕获到非空 value
        await waitFor(() => {
            expect(capturedValues.some((v) => v.length > 0)).toBe(true);
        });

        const latest = capturedValues.filter((v) => v.length > 0).at(-1);
        // 编辑器 value 契约为 HTML，预填必须来自 content_html
        expect(latest).toBe(existing.content_html);
    });
});
