import { afterEach, expect, it, vi } from "vitest";
import { createImageUploadTask } from "../image-upload-task";

afterEach(() => vi.restoreAllMocks());

it("交接预览后复用上传，最后一个持有者释放 URL", async () => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
	const revoke = vi.spyOn(URL, "revokeObjectURL");
	let finish!: (value: {
		id: string;
		url: string;
		width: number;
		height: number;
		size: number;
	}) => void;
	const upload = vi.fn(
		() =>
			new Promise<Parameters<typeof finish>[0]>((resolve) => {
				finish = resolve;
			}),
	);
	const task = createImageUploadTask(new File(["image"], "image.png"), upload);
	const releaseInput = task.retain();
	const first = task.upload();
	const releaseMessage = task.retain();
	releaseInput();
	releaseInput();
	expect(revoke).not.toHaveBeenCalled();
	const second = task.upload();
	finish({ id: "media", url: "/image.png", width: 1, height: 1, size: 5 });
	expect(await first).toEqual(await second);
	await task.upload();
	expect(upload).toHaveBeenCalledTimes(1);
	releaseMessage();
	expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:image");
});

it("失败后可使用原文件重试", async () => {
	const upload = vi
		.fn()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce({ id: "ok" });
	const task = createImageUploadTask(new File(["image"], "image.png"), upload);
	const release = task.retain();
	await expect(task.upload()).rejects.toThrow("offline");
	await expect(task.upload()).resolves.toEqual({ id: "ok" });
	expect(upload).toHaveBeenCalledTimes(2);
	release();
});
