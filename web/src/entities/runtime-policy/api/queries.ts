import * as api from "@entities/runtime-policy/api/client";
import { useQuery } from "@tanstack/react-query";

export const runtimePolicyKeys = {
	rateLimit: ["runtime-policy", "rate-limit"] as const,
	image: ["runtime-policy", "image"] as const,
	uploadQueue: ["runtime-policy", "upload-queue"] as const,
	codeRunner: ["runtime-policy", "code-runner"] as const,
	uploadProjection: ["runtime-policy", "upload-projection"] as const,
};

export const useRateLimitPolicy = () =>
	useQuery({
		queryKey: runtimePolicyKeys.rateLimit,
		queryFn: api.getRateLimitPolicy,
		retry: false,
		refetchInterval: 2000,
	});
export const useImagePolicy = () =>
	useQuery({
		queryKey: runtimePolicyKeys.image,
		queryFn: api.getImagePolicy,
		retry: false,
		refetchInterval: 2000,
	});
export const useUploadQueueSettings = () =>
	useQuery({
		queryKey: runtimePolicyKeys.uploadQueue,
		queryFn: api.getUploadQueueSettings,
		retry: false,
		refetchInterval: 2000,
	});
export const useCodeRunnerPolicy = () =>
	useQuery({
		queryKey: runtimePolicyKeys.codeRunner,
		queryFn: api.getCodeRunnerPolicy,
		retry: false,
		refetchInterval: 2000,
	});
export const useUploadQueuePolicy = () =>
	useQuery({
		queryKey: runtimePolicyKeys.uploadProjection,
		queryFn: api.getUploadQueuePolicy,
		retry: false,
		refetchInterval: 2000,
		refetchIntervalInBackground: false,
	});
