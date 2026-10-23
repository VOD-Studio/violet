import type {
	CodeRunnerPolicy,
	ImagePolicy,
	RateLimitPolicy,
	RuntimePolicyUpdate,
	RuntimePolicyView,
	UploadQueuePolicy,
	UploadQueuePolicyProjection,
} from "@entities/runtime-policy/model/types";
import { apiGet, apiPut } from "@shared/api/request";

export const getRateLimitPolicy = () =>
	apiGet<RuntimePolicyView<RateLimitPolicy>>("/admin/settings/rate-limit");
export const updateRateLimitPolicy = (body: RuntimePolicyUpdate<RateLimitPolicy>) =>
	apiPut<RuntimePolicyView<RateLimitPolicy>>("/admin/settings/rate-limit", body);
export const getImagePolicy = () => apiGet<RuntimePolicyView<ImagePolicy>>("/admin/settings/image");
export const updateImagePolicy = (body: RuntimePolicyUpdate<ImagePolicy>) =>
	apiPut<RuntimePolicyView<ImagePolicy>>("/admin/settings/image", body);
export const getUploadQueueSettings = () =>
	apiGet<RuntimePolicyView<UploadQueuePolicy>>("/admin/settings/upload-queue");
export const updateUploadQueueSettings = (body: RuntimePolicyUpdate<UploadQueuePolicy>) =>
	apiPut<RuntimePolicyView<UploadQueuePolicy>>("/admin/settings/upload-queue", body);
export const getCodeRunnerPolicy = () =>
	apiGet<RuntimePolicyView<CodeRunnerPolicy>>("/admin/settings/code-runner");
export const updateCodeRunnerPolicy = (body: RuntimePolicyUpdate<CodeRunnerPolicy>) =>
	apiPut<RuntimePolicyView<CodeRunnerPolicy>>("/admin/settings/code-runner", body);
export const getUploadQueuePolicy = () => apiGet<UploadQueuePolicyProjection>("/uploads/policy");
