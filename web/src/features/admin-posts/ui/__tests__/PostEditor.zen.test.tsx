/**
 * PostEditor Zen 专注模式测试
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { capturedValues, existing } = vi.hoisted(() => ({
    capturedValues: [] as string[],
    existing: {
        id: "p1",
        slug: "hello-world",
        title: "示例文章",
        content_html: "<p>正文</p>",
        content_md: "正文",
        excerpt: "",
        cover_image: "",
        seo_title: "",
        seo_description: "",
        tags: [] as string[],
        is_featured: false,
    },
}));

vi.mock("@features/editor", async () => {
    const React = await import("react");
    return {
        RichTextEditor: React.forwardRef<unknown, { value: string }>((props, _ref) => {
            capturedValues.push(props.value);
            return null;
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
    slugifyPost: () => Promise.resolve({ slug: "auto-slug" }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        fetchQuery: () => Promise.resolve(existing),
        invalidateQueries: () => {},
    }),
}));

vi.mock("@features/admin-posts/ui/PostEditorSidebar", () => ({ PostEditorSidebar: () => null }));
vi.mock("@features/admin-posts/ui/PostVersionsSheet", () => ({ PostVersionsSheet: () => null }));
vi.mock("@features/admin-media/ui/MediaPicker", () => ({ MediaPicker: () => null }));

import { PostEditor } from "@features/admin-posts/ui/PostEditor";
import { usePostEditorStore } from "@features/admin-posts/ui/post-editor-store";

describe("PostEditor Zen 专注模式", () => {
    beforeEach(() => {
        cleanup();
        localStorage.clear();
        usePostEditorStore.setState({ zenMode: false });
    });
    it("非专注模式显示专注按钮，标题为新建文章", () => {
        render(<PostEditor />);
        expect(screen.getByRole("button", { name: "专注" })).toBeTruthy();
    });

    it("点击专注后标题变为专注写作，偏好持久化", async () => {
        render(<PostEditor />);
        expect(screen.queryByText("专注写作")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "专注" }));
        await waitFor(() => {
            expect(screen.getByText("专注写作")).toBeTruthy();
        });
        const raw = localStorage.getItem("post-editor");
        expect(JSON.parse(raw ?? "{}").state.zenMode).toBe(true);
    });

    it("专注模式下按 Esc 退出（非 input/textarea 焦点时）", async () => {
        render(<PostEditor />);
        fireEvent.click(screen.getByRole("button", { name: "专注" }));
        await waitFor(() => {
            expect(screen.getByText("专注写作")).toBeTruthy();
        });
        fireEvent.keyDown(document.body, { key: "Escape" });
        await waitFor(() => {
            expect(screen.queryByText("专注写作")).toBeNull();
            expect(screen.getByText("新建文章")).toBeTruthy();
        });
        expect(JSON.parse(localStorage.getItem("post-editor") ?? "{}").state.zenMode).toBe(false);
    });

    it("专注根容器 z-index 低于弹窗（z-50）", () => {
        usePostEditorStore.setState({ zenMode: true });
        const { container } = render(<PostEditor />);
        const zenRoot = container.firstElementChild as HTMLElement;
        expect(zenRoot.className).not.toContain("z-[100]");
        expect(zenRoot.className).toContain("z-40");
    });
});
