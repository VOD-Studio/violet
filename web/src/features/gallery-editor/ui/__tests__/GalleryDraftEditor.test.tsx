import { ApiError } from "@shared/api/error";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { blocker, detail, mediaPickerProps, mutateAsync, permission, refetch } = vi.hoisted(() => {
	const gallery = {
		id: "gallery-1",
		author_id: "author-1",
		title: "原始标题",
		summary: "原始摘要",
		status: "draft",
		version: 4,
		item_count: 1,
		created_at: "2026-08-30T00:00:00Z",
		updated_at: "2026-08-30T00:00:00Z",
		items: [
			{
				file_id: "a",
				position: 0,
				url: "/a.jpg",
				thumbnail: "/a-thumb.jpg",
				mime_type: "image/jpeg",
				width: 800,
				height: 1200,
				asset_alt_text: "图片 A",
				caption: "",
				alt_text_override: "",
			},
		],
	};
	return {
		blocker: vi.fn(),
		detail: gallery,
		mediaPickerProps: vi.fn(),
		mutateAsync: vi.fn(),
		permission: { canManage: true },
		refetch: vi.fn(),
	};
});

vi.mock("@tanstack/react-router", () => ({ useBlocker: blocker }));

vi.mock("@features/gallery-editor/api/queries", () => ({
	useGalleryDraft: () => ({ data: detail, isLoading: false, error: null, refetch }),
}));

vi.mock("@features/gallery-editor/api/mutations", () => ({
	useSaveGalleryDraft: () => ({ mutateAsync }),
}));

vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => permission.canManage,
}));

vi.mock("@entities/media/ui/MediaPicker", () => ({
	MediaPicker: (props: { onConfirm: (files: unknown[]) => void; source?: string }) => {
		mediaPickerProps(props);
		return (
			<button
				type="button"
				onClick={() =>
					props.onConfirm([
						{
							id: "b",
							owner_id: "author-1",
							purpose: "material",
							original_name: "b.jpg",
							url: "/b.jpg",
							size: 100,
							mime_type: "image/jpeg",
							thumbnail: "/b-thumb.jpg",
							status: "ready",
							created_at: "2026-08-30T00:00:00Z",
						},
						{
							id: "c",
							owner_id: "author-1",
							purpose: "material",
							original_name: "c.jpg",
							url: "/c.jpg",
							size: 100,
							mime_type: "image/jpeg",
							thumbnail: "/c-thumb.jpg",
							status: "ready",
							created_at: "2026-08-30T00:00:00Z",
						},
					])
				}
			>
				确认选择测试图片
			</button>
		);
	},
}));

vi.mock("@features/upload/ui/Uploader", () => ({
	Uploader: ({
		onUploaded,
	}: {
		onUploaded?: (result: Record<string, unknown>, file: File) => void;
	}) => (
		<button
			type="button"
			onClick={() =>
				onUploaded?.(
					{
						file_id: "uploaded",
						url: "/uploaded.jpg",
						thumbnail: "/uploaded-thumb.jpg",
						width: 1200,
						height: 800,
					},
					new File([], "uploaded.jpg", { type: "image/jpeg" }),
				)
			}
		>
			上传测试图片
		</button>
	),
}));
vi.mock("@shared/ui/photo-stack", () => ({ PhotoStack: () => <div>工作稿图片预览</div> }));

import { GalleryDraftEditor } from "../GalleryDraftEditor";

describe("GalleryDraftEditor", () => {
	beforeEach(() => {
		vi.useRealTimers();
		blocker.mockReset();
		mediaPickerProps.mockReset();
		mutateAsync.mockReset();
		permission.canManage = true;
		refetch.mockReset();
		refetch.mockResolvedValue({ data: detail, isSuccess: true });
		mutateAsync.mockImplementation(async (input) => ({
			...detail,
			...input,
			version: input.expected_version + 1,
			item_count: input.items.length,
			items: detail.items,
		}));
	});

	it("选择、排序后显式保存完整 document", async () => {
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新标题" } });
		fireEvent.click(screen.getByRole("button", { name: "从素材库选择" }));
		fireEvent.click(screen.getByRole("button", { name: "确认选择测试图片" }));
		fireEvent.click(screen.getByRole("button", { name: "将第 3 张图片前移" }));
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
		expect(mutateAsync).toHaveBeenCalledWith({
			expected_version: 4,
			title: "新标题",
			summary: "原始摘要",
			items: [
				{ file_id: "a", caption: "", alt_text_override: "" },
				{ file_id: "c", caption: "", alt_text_override: "" },
				{ file_id: "b", caption: "", alt_text_override: "" },
			],
		});
		expect(mediaPickerProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ source: "owned" }),
		);
	}, 20_000);

	it("上传图片并保存 caption 与 alt override", async () => {
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "上传测试图片" }));
		fireEvent.change(screen.getAllByLabelText("图片说明")[1], {
			target: { value: "上传图片说明" },
		});
		fireEvent.change(screen.getAllByLabelText("替代文本覆盖")[1], {
			target: { value: "上传图片替代文本" },
		});
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				items: [
					{ file_id: "a", caption: "", alt_text_override: "" },
					{
						file_id: "uploaded",
						caption: "上传图片说明",
						alt_text_override: "上传图片替代文本",
					},
				],
			}),
		);
	});

	it("本地改动停顿后自动保存完整 document", async () => {
		vi.useFakeTimers();
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("摘要"), { target: { value: "自动保存摘要" } });

		await act(async () => {
			vi.advanceTimersByTime(1000);
			await Promise.resolve();
		});

		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				expected_version: 4,
				summary: "自动保存摘要",
			}),
		);
	});

	it("保存进行中继续编辑会用新版本接力保存", async () => {
		vi.useFakeTimers();
		let resolveFirst: (value: typeof detail) => void = () => undefined;
		mutateAsync.mockImplementationOnce(
			() =>
				new Promise<typeof detail>((resolve) => {
					resolveFirst = resolve;
				}),
		);
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("标题"), { target: { value: "第一次保存" } });
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));
		fireEvent.change(screen.getByLabelText("摘要"), { target: { value: "请求期间继续编辑" } });

		await act(async () => {
			resolveFirst({ ...detail, title: "第一次保存", version: 5 });
			await Promise.resolve();
		});
		await act(async () => {
			vi.advanceTimersByTime(1000);
			await Promise.resolve();
		});

		expect(mutateAsync).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				expected_version: 5,
				title: "第一次保存",
				summary: "请求期间继续编辑",
			}),
		);
	});

	it("409 时停止覆盖并显示重新载入入口", async () => {
		mutateAsync.mockRejectedValueOnce(
			new ApiError({ error: "CONFLICT", message: "version conflict", status: 409 }),
		);
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("标题"), { target: { value: "冲突标题" } });
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));

		await screen.findByText(
			"服务器上的工作稿已更新。为避免覆盖他人的修改，请重新载入最新版本。",
		);
		expect(screen.getByRole("button", { name: "重新载入" })).toBeTruthy();
	});

	it("409 重载失败时保留本地修改与冲突状态", async () => {
		mutateAsync.mockRejectedValueOnce(
			new ApiError({ error: "CONFLICT", message: "version conflict", status: 409 }),
		);
		refetch.mockResolvedValueOnce({ data: detail, isSuccess: false });
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("标题"), { target: { value: "本地冲突标题" } });
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));
		await screen.findByRole("button", { name: "重新载入" });
		fireEvent.click(screen.getByRole("button", { name: "重新载入" }));

		await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
		expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("本地冲突标题");
		expect(screen.getByRole("button", { name: "重新载入" })).toBeTruthy();
	});

	it("未保存或冲突状态阻止站内导航", async () => {
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("摘要"), { target: { value: "尚未保存" } });

		await waitFor(() =>
			expect(blocker).toHaveBeenLastCalledWith(
				expect.objectContaining({ disabled: false, enableBeforeUnload: true }),
			),
		);
	});

	it("只有查看权限时编辑动作全部只读", () => {
		permission.canManage = false;
		render(<GalleryDraftEditor id="gallery-1" />);

		expect((screen.getByLabelText("标题") as HTMLInputElement).disabled).toBe(true);
		expect(
			(screen.getByRole("button", { name: "从素材库选择" }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(
			(screen.getByRole("button", { name: "保存工作稿" }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(screen.queryByRole("button", { name: "上传测试图片" })).toBeNull();
	});
});
