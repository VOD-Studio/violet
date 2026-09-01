import type { MediaFile } from "@entities/media/model/types";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { viewerProps } = vi.hoisted(() => ({ viewerProps: vi.fn() }));

vi.mock("@shared/ui/media-viewer", () => ({
	MediaViewer: (props: unknown) => {
		viewerProps(props);
		return null;
	},
}));

import { MediaLightbox } from "../MediaLightbox";

const file: MediaFile = {
	id: "file-1",
	owner_id: "owner-1",
	purpose: "material",
	original_name: "clip.mp4",
	url: "/clip.mp4",
	size: 4096,
	mime_type: "video/mp4",
	thumbnail: "/clip.jpg",
	status: "active",
	created_at: "2026-08-31T00:00:00Z",
};

describe("MediaLightbox adapter", () => {
	it("只负责把 MediaFile 映射为 MediaViewerItem", () => {
		const trigger = document.createElement("button");
		const onOpenChange = vi.fn();
		const onIndexChange = vi.fn();
		render(
			<MediaLightbox
				open
				onOpenChange={onOpenChange}
				files={[file]}
				index={0}
				onIndexChange={onIndexChange}
				triggerElement={trigger}
			/>,
		);

		expect(viewerProps).toHaveBeenCalledWith({
			open: true,
			onOpenChange,
			items: [
				{
					id: "file-1",
					url: "/clip.mp4",
					thumbnailUrl: "/clip.jpg",
					mimeType: "video/mp4",
					name: "clip.mp4",
					size: 4096,
				},
			],
			index: 0,
			onIndexChange,
			triggerElement: trigger,
		});
	});
});
