import { ApiError } from "@shared/api/error";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	blocker,
	deleteMutateAsync,
	detail,
	mediaPickerProps,
	navigate,
	permission,
	publishMutateAsync,
	publishResult,
	refetch,
	saveMutateAsync,
	unpublishMutateAsync,
	unpublishResult,
} = vi.hoisted(() => {
	const gallery = {
		id: "gallery-1",
		author_id: "author-1",
		title: "原始标题",
		summary: "原始摘要",
		status: "draft" as "draft" | "published" | "modified" | "unpublished",
		slug: null as string | null,
		published_at: null as string | null,
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
		deleteMutateAsync: vi.fn(),
		detail: gallery,
		mediaPickerProps: vi.fn(),
		navigate: vi.fn(),
		permission: { canManage: true },
		publishMutateAsync: vi.fn(),
		publishResult: {
			data: undefined as
				| {
						slug: string | null;
						status: "draft" | "published" | "modified" | "unpublished";
						version: number;
				  }
				| undefined,
		},
		refetch: vi.fn(),
		saveMutateAsync: vi.fn(),
		unpublishMutateAsync: vi.fn(),
		unpublishResult: {
			data: undefined as
				| {
						slug: string | null;
						status: "draft" | "published" | "modified" | "unpublished";
						version: number;
				  }
				| undefined,
		},
	};
});

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, params }: { children: ReactNode; params: { slug: string } }) => (
		<a href={`/galleries/${params.slug}`}>{children}</a>
	),
	useBlocker: blocker,
	useNavigate: () => navigate,
}));

vi.mock("@features/gallery-editor/api/queries", () => ({
	useGalleryDraft: () => ({ data: detail, isLoading: false, error: null, refetch }),
}));

vi.mock("@features/gallery-editor/api/mutations", () => ({
	usePublishGallery: () => ({
		mutateAsync: publishMutateAsync,
		isPending: false,
		data: publishResult.data,
	}),
	useUnpublishGallery: () => ({
		mutateAsync: unpublishMutateAsync,
		isPending: false,
		data: unpublishResult.data,
	}),
	useDeleteGallery: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
	useSaveGalleryDraft: () => ({ mutateAsync: saveMutateAsync }),
}));

vi.mock("@shared/ui/confirm-dialog", () => ({
	ConfirmDialog: ({
		open,
		confirmLabel,
		onConfirm,
	}: {
		open: boolean;
		confirmLabel: string;
		onConfirm: () => void;
	}) =>
		open ? (
			<button type="button" onClick={onConfirm}>
				确认{confirmLabel}
			</button>
		) : null,
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
		deleteMutateAsync.mockReset();
		navigate.mockReset();
		mediaPickerProps.mockReset();
		publishMutateAsync.mockReset();
		publishResult.data = undefined;
		unpublishMutateAsync.mockReset();
		unpublishResult.data = undefined;
		saveMutateAsync.mockReset();
		permission.canManage = true;
		detail.status = "draft";
		detail.slug = null;
		detail.published_at = null;
		detail.version = 4;
		refetch.mockReset();
		refetch.mockResolvedValue({ data: detail, isSuccess: true });
		saveMutateAsync.mockImplementation(async (input) => ({
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

		await waitFor(() => expect(saveMutateAsync).toHaveBeenCalledTimes(1));
		expect(saveMutateAsync).toHaveBeenCalledWith({
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

		await waitFor(() => expect(saveMutateAsync).toHaveBeenCalledTimes(1));
		expect(saveMutateAsync).toHaveBeenCalledWith(
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

		expect(saveMutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				expected_version: 4,
				summary: "自动保存摘要",
			}),
		);
	});

	it("保存进行中继续编辑会用新版本接力保存", async () => {
		vi.useFakeTimers();
		let resolveFirst: (value: typeof detail) => void = () => undefined;
		saveMutateAsync.mockImplementationOnce(
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

		expect(saveMutateAsync).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				expected_version: 5,
				title: "第一次保存",
				summary: "请求期间继续编辑",
			}),
		);
	});

	it("409 时停止覆盖并显示重新载入入口", async () => {
		saveMutateAsync.mockRejectedValueOnce(
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
		saveMutateAsync.mockRejectedValueOnce(
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
		expect(
			(screen.getByRole("button", { name: "发布图集" }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(screen.queryByRole("button", { name: "上传测试图片" })).toBeNull();
	});

	it("用当前已保存版本发布并提供公开详情入口", async () => {
		publishMutateAsync.mockImplementationOnce(async () => {
			const published = {
				...detail,
				status: "published" as const,
				slug: "summer-light",
				published_at: "2026-08-31T00:00:00Z",
				version: 5,
			};
			publishResult.data = published;
			Object.assign(detail, published);
			return published;
		});
		const view = render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "发布图集" }));

		await waitFor(() =>
			expect(publishMutateAsync).toHaveBeenCalledWith({ expected_version: 4 }),
		);
		view.rerender(<GalleryDraftEditor id="gallery-1" />);
		expect(screen.getByRole("link", { name: "查看公开页面" }).getAttribute("href")).toBe(
			"/galleries/summer-light",
		);
	});

	it.each([
		{
			status: 400,
			apiMessage: "素材 file-pdf 的 MIME 类型不是图片",
			message: "素材 file-pdf 的 MIME 类型不是图片",
		},
		{
			status: 409,
			apiMessage: "version conflict",
			message: "工作稿已在其他窗口更新，请重新载入后再发布。",
		},
	])("发布 $status 时显示可操作反馈", async ({ status, apiMessage, message }) => {
		publishMutateAsync.mockRejectedValueOnce(
			new ApiError({ error: "PUBLISH_FAILED", message: apiMessage, status }),
		);
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "发布图集" }));

		expect(await screen.findByText(message)).toBeTruthy();
		if (status === 409) {
			expect(screen.getByRole("button", { name: "重新载入" })).toBeTruthy();
		}
	});

	it("修改态保留旧公开入口并允许更新发布", async () => {
		detail.status = "modified";
		detail.slug = "summer-light";
		detail.published_at = "2026-08-31T00:00:00Z";
		render(<GalleryDraftEditor id="gallery-1" />);

		expect(screen.getByRole("link", { name: "查看公开页面" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "撤回公开" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "更新发布" }));

		await waitFor(() =>
			expect(publishMutateAsync).toHaveBeenCalledWith({ expected_version: 4 }),
		);
	});

	it("撤回后保留 slug 并切换为重新发布", async () => {
		detail.status = "published";
		detail.slug = "summer-light";
		detail.published_at = "2026-08-31T00:00:00Z";
		unpublishMutateAsync.mockImplementationOnce(async () => {
			const result = { slug: "summer-light", status: "unpublished" as const, version: 5 };
			unpublishResult.data = result;
			Object.assign(detail, result);
			return result;
		});
		const view = render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "撤回公开" }));
		fireEvent.click(screen.getByRole("button", { name: "确认撤回公开" }));

		await waitFor(() =>
			expect(unpublishMutateAsync).toHaveBeenCalledWith({ expected_version: 4 }),
		);
		view.rerender(<GalleryDraftEditor id="gallery-1" />);
		expect(screen.getByRole("button", { name: "重新发布" })).toBeTruthy();
		expect(screen.queryByRole("link", { name: "查看公开页面" })).toBeNull();
	});

	it("永久删除携带版本并返回管理列表", async () => {
		deleteMutateAsync.mockResolvedValueOnce(null);
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "永久删除" }));
		fireEvent.click(screen.getByRole("button", { name: "确认永久删除" }));

		await waitFor(() =>
			expect(deleteMutateAsync).toHaveBeenCalledWith({ expected_version: 4 }),
		);
		expect(navigate).toHaveBeenCalledWith({ to: "/admin/galleries" });
	});

	it("撤回发生 409 时要求重新载入", async () => {
		detail.status = "published";
		detail.slug = "summer-light";
		unpublishMutateAsync.mockRejectedValueOnce(
			new ApiError({ error: "CONFLICT", message: "version conflict", status: 409 }),
		);
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "撤回公开" }));
		fireEvent.click(screen.getByRole("button", { name: "确认撤回公开" }));

		expect(await screen.findByText("图集已在其他窗口更新，请重新载入后再操作。")).toBeTruthy();
		expect(screen.getByRole("button", { name: "重新载入" })).toBeTruthy();
	});

	it("首次发布后继续保存会显示更新发布而不受旧 mutation 结果影响", async () => {
		detail.status = "published";
		detail.slug = "summer-light";
		detail.published_at = "2026-08-31T00:00:00Z";
		publishResult.data = { slug: "summer-light", status: "published", version: 4 };
		saveMutateAsync.mockImplementationOnce(async (input) => {
			const saved = {
				...detail,
				...input,
				status: "modified" as const,
				version: 5,
				item_count: input.items.length,
			};
			Object.assign(detail, saved);
			return saved;
		});
		render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.change(screen.getByLabelText("标题"), { target: { value: "发布后修改" } });
		fireEvent.click(screen.getByRole("button", { name: "保存工作稿" }));

		expect(await screen.findByRole("button", { name: "更新发布" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "查看公开页面" })).toBeTruthy();
	});

	it("撤回后重新发布会清除旧撤回结果", async () => {
		detail.status = "unpublished";
		detail.slug = "summer-light";
		detail.version = 5;
		detail.published_at = "2026-08-31T00:00:00Z";
		unpublishResult.data = { slug: "summer-light", status: "unpublished", version: 5 };
		publishMutateAsync.mockImplementationOnce(async () => {
			const republished = { slug: "summer-light", status: "published" as const, version: 6 };
			Object.assign(detail, republished);
			return republished;
		});
		const view = render(<GalleryDraftEditor id="gallery-1" />);
		fireEvent.click(screen.getByRole("button", { name: "重新发布" }));
		await waitFor(() =>
			expect(publishMutateAsync).toHaveBeenCalledWith({ expected_version: 5 }),
		);
		view.rerender(<GalleryDraftEditor id="gallery-1" />);

		expect(screen.queryByRole("button", { name: "重新发布" })).toBeNull();
		expect(screen.getByRole("link", { name: "查看公开页面" })).toBeTruthy();
	});
});
