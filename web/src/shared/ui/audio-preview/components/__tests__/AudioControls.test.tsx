import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";
import { AudioControls } from "../AudioControls";

it("播放与静音状态变化后，读屏名称指向下一步动作", () => {
	const props = {
		state: {
			isPlaying: false,
			isReady: true,
			currentTime: 0,
			duration: 120,
			volume: 1,
			isMuted: false,
			playbackRate: 1,
			isLooping: false,
			isEnded: false,
		},
		onTogglePlay: vi.fn(),
		onSeek: vi.fn(),
		onSetVolume: vi.fn(),
		onToggleMute: vi.fn(),
		onSetPlaybackRate: vi.fn(),
		onToggleLoop: vi.fn(),
	} satisfies ComponentProps<typeof AudioControls>;
	const { rerender } = render(<AudioControls {...props} />);
	expect(screen.getByRole("button", { name: "播放" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "静音" })).toBeTruthy();

	rerender(
		<AudioControls {...props} state={{ ...props.state, isPlaying: true, isMuted: true }} />,
	);
	expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "取消静音" })).toBeTruthy();

	rerender(<AudioControls {...props} />);
	expect(screen.getByRole("button", { name: "播放" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "静音" })).toBeTruthy();
});
