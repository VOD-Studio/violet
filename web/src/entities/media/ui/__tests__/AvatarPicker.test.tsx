import type { MediaFile } from "@entities/media/model/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mediaFile } = vi.hoisted(() => ({
	mediaFile: {
		id: "media-1",
		owner_id: "user-1",
		purpose: "material",
		original_name: "saber.png",
		url: "/uploads/saber.png",
		size: 1024,
		mime_type: "image/png",
		thumbnail: "/uploads/saber-thumb.png",
		status: "active",
		alt_text: "Saber 立绘",
		created_at: "2026-01-01T00:00:00Z",
	} satisfies MediaFile,
}));

vi.mock("@entities/media/api/queries", () => ({
	useMediaCatalog: () => ({
		data: { data: [mediaFile], pagination: { page: 1, limit: 40, total: 1 } },
		isLoading: false,
	}),
}));

import { AvatarPicker } from "../AvatarPicker";

afterEach(() => cleanup());

describe("AvatarPicker", () => {
	it("空状态点头像块开素材库，选中图片回传原始素材", () => {
		const onChange = vi.fn();
		render(<AvatarPicker value="" onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: "选择头像" }));
		// 素材网格里的按钮名由缩略图 alt 与文件名拼出，用正则而非精确串
		fireEvent.click(screen.getByRole("button", { name: /Saber/ }));

		expect(onChange).toHaveBeenCalledWith(mediaFile);
	});

	it("已有头像时角标回传 null 表示清除", () => {
		const onChange = vi.fn();
		render(<AvatarPicker value="/uploads/saber.png" onChange={onChange} />);

		expect(screen.getByRole("button", { name: "更换头像" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "移除头像" }));

		expect(onChange).toHaveBeenCalledWith(null);
	});

	it("禁用态不开素材库", () => {
		const onChange = vi.fn();
		render(<AvatarPicker value="" onChange={onChange} disabled />);

		fireEvent.click(screen.getByRole("button", { name: "选择头像" }));

		expect(screen.queryByText("点击素材直接选择")).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});
});
