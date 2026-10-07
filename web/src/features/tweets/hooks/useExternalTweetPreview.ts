import type { ExternalTweet } from "@entities/tweet/model/types";
import { apiPost } from "@shared/api/request";
import { useEffect, useRef, useState } from "react";

/** 只有完整且已准备媒体的预览才带发布凭证。 */
export interface ExternalTweetPreview {
	external_tweet: ExternalTweet;
	preview_token: string;
	expires_at: string;
	can_publish: boolean;
	warnings: string[] | null;
}

/** 发布器持有的链接、可发布凭证及请求生命周期。 */
export interface ExternalTweetPreviewState {
	url: string;
	preview: ExternalTweetPreview | null;
	loading: boolean;
	error: string | null;
	expired: boolean;
	setUrl: (value: string) => void;
	load: () => Promise<void>;
	reset: () => void;
	invalidate: (message?: string | null) => void;
}

/** 更换链接、取消或卸载均使旧请求失效，保留发布器自己的感想和图片。 */
export function useExternalTweetPreview(): ExternalTweetPreviewState {
	const [url, setInput] = useState("");
	const [preview, setPreview] = useState<ExternalTweetPreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expired, setExpired] = useState(false);
	const generation = useRef(0);
	const request = useRef<AbortController | null>(null);

	const invalidate = (message: string | null = null) => {
		generation.current++;
		request.current?.abort();
		setPreview(null);
		setLoading(false);
		setExpired(false);
		setError(message);
	};
	const setUrl = (value: string) => {
		invalidate();
		setInput(value);
	};
	const reset = () => {
		invalidate();
		setInput("");
	};
	const load = async () => {
		invalidate();
		if (!url.trim()) {
			setError("请粘贴完整的 X 推文链接");
			return;
		}
		const current = generation.current;
		const controller = new AbortController();
		request.current = controller;
		setLoading(true);
		try {
			const result = await apiPost<ExternalTweetPreview>(
				"/tweets/external/preview",
				{ url: url.trim() },
				{ signal: controller.signal, timeout: 35000 },
			);
			if (current !== generation.current) return;
			if (!result.can_publish || !result.preview_token || !result.external_tweet.snapshot) {
				setError("当前原文无法发布，请重试或在 X 查看");
				return;
			}
			setPreview(result);
		} catch (failure) {
			if (current === generation.current && !controller.signal.aborted) {
				setError(failure instanceof Error ? failure.message : "预览失败，请重试");
			}
		} finally {
			if (current === generation.current) setLoading(false);
		}
	};

	useEffect(
		() => () => {
			generation.current++;
			request.current?.abort();
		},
		[],
	);
	useEffect(() => {
		if (!preview) return;
		const delay = Date.parse(preview.expires_at) - Date.now();
		if (!Number.isFinite(delay) || delay <= 0) {
			setExpired(true);
			return;
		}
		const timeout = window.setTimeout(() => setExpired(true), delay);
		return () => window.clearTimeout(timeout);
	}, [preview]);

	return { url, preview, loading, error, expired, setUrl, load, reset, invalidate };
}
