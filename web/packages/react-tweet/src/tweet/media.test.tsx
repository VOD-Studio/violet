import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { EmbeddedTweet } from "../unstyled.js";

afterEach(cleanup);

it("照片网格不跨越视频合并，保留来源媒体的阅读顺序", () => {
	const { container } = render(
		<EmbeddedTweet
			tweet={{
				url: "https://x.com/jack/status/20",
				availability: "available",
				snapshot: {
					author: { name: "Jack", handle: "jack" },
					text: "按顺序阅读媒体",
					media: [
						{ kind: "photo", url: "/first.jpg" },
						{ kind: "video", url: "/middle.mp4" },
						{ kind: "photo", url: "/last.jpg" },
					],
				},
			}}
		/>,
	);
	expect(
		Array.from(container.querySelectorAll("img, video"), (media) => media.getAttribute("src")),
	).toEqual(["/first.jpg", "/middle.mp4", "/last.jpg"]);
});
