import { ApiError } from "@shared/api/error";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateTweet } from "../api/mutations";
import { MAX_TWEET_LENGTH } from "../model/types";
import type { ExternalTweetPreviewState } from "./useExternalTweetPreview";

interface TweetComposerSubmitOptions {
	content: string;
	images: string[];
	quoteId?: string;
	externalMode: boolean;
	external: ExternalTweetPreviewState;
	uploading: boolean;
	onSuccess: () => void;
}

interface TweetComposerSubmission {
	canSubmit: boolean;
	isPending: boolean;
	error: string | null;
	submit: () => void;
}

/** 相同 X 转发重试复用请求 ID；切换到普通发布不会携带预览凭证。 */
export function useTweetComposerSubmit({
	content,
	images,
	quoteId,
	externalMode,
	external,
	uploading,
	onSuccess,
}: TweetComposerSubmitOptions): TweetComposerSubmission {
	const create = useCreateTweet();
	const submitting = useRef(false);
	const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
	const [failure, setFailure] = useState<{ fingerprint: string; message: string } | null>(null);
	const body = {
		content: content.trim(),
		images,
		quote_of: quoteId,
		...(externalMode && external.preview
			? { external_preview_token: external.preview.preview_token }
			: {}),
	};
	const fingerprint = JSON.stringify(body);
	const retrying =
		failure?.fingerprint === fingerprint && attempt.current?.fingerprint === fingerprint;
	const readyExternal =
		externalMode && !!external.preview?.can_publish && (!external.expired || retrying);
	const canSubmit =
		!create.isPending &&
		!uploading &&
		[...content].length <= MAX_TWEET_LENGTH &&
		(!externalMode || readyExternal) &&
		(!!content.trim() || images.length > 0 || !!quoteId || readyExternal);

	const submit = () => {
		if (submitting.current || !canSubmit) return;
		if (externalMode && attempt.current?.fingerprint !== fingerprint) {
			attempt.current = { fingerprint, id: crypto.randomUUID() };
		}
		submitting.current = true;
		setFailure(null);
		create.mutate(
			{ ...body, ...(externalMode ? { client_request_id: attempt.current?.id } : {}) },
			{
				onSuccess: () => {
					submitting.current = false;
					attempt.current = null;
					external.reset();
					onSuccess();
					toast.success("已发布");
				},
				onError: (error) => {
					submitting.current = false;
					if (error instanceof ApiError && error.code.startsWith("EXTERNAL_PREVIEW_")) {
						attempt.current = null;
						external.invalidate(error.message);
					}
					const message = error instanceof Error ? error.message : "发布失败，请重试";
					setFailure({ fingerprint, message });
					toast.error(message);
				},
			},
		);
	};
	return {
		canSubmit,
		isPending: create.isPending,
		error: failure?.fingerprint === fingerprint ? failure.message : null,
		submit,
	};
}
