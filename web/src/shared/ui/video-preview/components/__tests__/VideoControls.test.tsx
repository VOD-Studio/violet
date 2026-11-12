import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";
import { VideoControls } from "../VideoControls";

it("播放、静音、结束与全屏状态具有对应的可访问动作", () => {
	const props = {
		state: {
			isPlaying: false,
			currentTime: 0,
			duration: 120,
			volume: 1,
			isMuted: false,
			playbackRate: 1,
			isWaiting: false,
			isEnded: false,
		},
		menuOpen: false,
		onMenuOpenChange: vi.fn(),
		onTogglePlay: vi.fn(),
		onSeek: vi.fn(),
		onSetVolume: vi.fn(),
		onToggleMute: vi.fn(),
		onSetPlaybackRate: vi.fn(),
		onToggleFullscreen: vi.fn(),
		isFullscreen: false,
	} satisfies ComponentProps<typeof VideoControls>;
	const { rerender } = render(<VideoControls {...props} />);
	expect(screen.getByRole("button", { name: "播放" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "静音" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "全屏" })).toBeTruthy();

	rerender(
		<VideoControls
			{...props}
			state={{ ...props.state, isPlaying: true, isMuted: true }}
			isFullscreen
		/>,
	);
	expect(screen.getByRole("button", { name: "暂停" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "取消静音" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "退出全屏" })).toBeTruthy();

	rerender(<VideoControls {...props} state={{ ...props.state, isEnded: true }} />);
	expect(screen.getByRole("button", { name: "重播" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "静音" })).toBeTruthy();
});
