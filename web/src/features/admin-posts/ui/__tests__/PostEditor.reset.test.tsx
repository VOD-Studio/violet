/**
 * PostEditor 清空（新建）/ 重置（编辑）回归测试
 *
 * 背景：新建模式用固定键 post-draft:new 自动恢复 localStorage 草稿。
 * 用户在新建页输入后未保存即离开，草稿残留，下次点新建即恢复旧数据，
 * 表现为「点击新增文章时显示了之前的文章数据」。
 *
 * 本测试覆盖新增的清空/重置按钮：
 * - 新建模式清空：清空全部字段 + 删除本地草稿 + 编辑器 value 收敛为空。
 * - 编辑模式重置：放弃改动，恢复到服务器原始数据。
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// capturedValues 需在 vi.mock factory 中引用，故用 hoisted 提前初始化
const { capturedValues, existing } = vi.hoisted(() => ({
    capturedValues: [] as string[],
    existing: {
        id: "p1",
        slug: "hello-world",
        title: "示例文章",
        content_html: "<h1>标题</h1><p>正文<strong>加粗</strong></p>",
        content_md: "# 标题",
        excerpt: "原始摘要",
        cover_image: "",
        seo_title: "",
        seo_description: "",
        tags: ["t1"] as string[],
        is_featured: false,
    },
}));

// RichTextEditor：仅捕获收到的 value，验证清空后收敛为空串
vi.mock("@features/editor", async () => {
    const React = await import("react");
    return {
        RichTextEditor: React.forwardRef<unknown, { value: string }>((props, _ref) => {
            capturedValues.push(props.value);
            return null;
        }),
    };
});

// 数据层：编辑态返回样例文章，新建态不启用查询
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

// 切断子组件依赖链；不 mock Toolbar / ConfirmDialog（需测真实交互）
vi.mock("@features/admin-posts/ui/PostEditorSidebar", () => ({ PostEditorSidebar: () => null }));
vi.mock("@features/admin-posts/ui/PostVersionsSheet", () => ({ PostVersionsSheet: () => null }));
vi.mock("@features/admin-media/ui/MediaPicker", () => ({ MediaPicker: () => null }));

import { PostEditor } from "@features/admin-posts/ui/PostEditor";

describe("PostEditor 清空/重置", () => {
    beforeEach(() => {
        capturedValues.length = 0;
        localStorage.clear();
    });

    it("新建模式点击清空后清空表单、删除草稿、编辑器内容收敛为空", async () => {
        // 预置残留草稿（复现 bug 的前置：上次新建未保存即离开）
        localStorage.setItem(
            "post-draft:new",
            JSON.stringify({
                title: "上次未保存的草稿",
                slug: "stale-slug",
                content_html: "<p>残留内容</p>",
                excerpt: "残留摘要",
            }),
        );

        render(<PostEditor />);

        // 草稿恢复：标题输入框先显示旧草稿（确认 bug 前置存在）
        await waitFor(() => {
            expect(screen.getByDisplayValue("上次未保存的草稿")).toBeTruthy();
        });

        // 点击工具栏「清空」按钮
        fireEvent.click(screen.getByRole("button", { name: /^清空$/ }));

        // 确认弹窗内的「清空」按钮（与工具栏按钮同名，限定在 dialog 内取）
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "清空" }));

        // 标题已清空（旧值消失）
        await waitFor(() => {
            expect(screen.queryByDisplayValue("上次未保存的草稿")).toBeNull();
        });
        expect(screen.queryByDisplayValue("stale-slug")).toBeNull();
        // 本地草稿已删除
        expect(localStorage.getItem("post-draft:new")).toBeNull();
        // 编辑器最后一次收到的 value 为空串（reset content_html="" 经同步 effect 收敛）
        expect(capturedValues.at(-1)).toBe("");
    });

    it("编辑模式点击重置后放弃改动并恢复服务器原始数据", async () => {
        render(<PostEditor postId="p1" />);

        // 等 existing 预填完成
        await waitFor(() => {
            expect(screen.getByDisplayValue("示例文章")).toBeTruthy();
        });

        // 手动修改标题（制造未保存的改动）
        fireEvent.change(screen.getByDisplayValue("示例文章"), {
            target: { value: "被修改的标题" },
        });
        await waitFor(() => {
            expect(screen.getByDisplayValue("被修改的标题")).toBeTruthy();
        });

        // 点击工具栏「重置」
        fireEvent.click(screen.getByRole("button", { name: /^重置$/ }));

        // 确认弹窗内的「重置」按钮
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "重置" }));

        // 恢复为服务器原始标题
        await waitFor(() => {
            expect(screen.getByDisplayValue("示例文章")).toBeTruthy();
        });
        // 编辑器 value 恢复为原始 content_html
        const nonEmpty = capturedValues.filter((v) => v.length > 0).at(-1);
        expect(nonEmpty).toBe(existing.content_html);
    });
});
