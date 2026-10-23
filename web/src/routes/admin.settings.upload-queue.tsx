import { UploadQueuePolicyPage } from "@features/admin-settings/ui/UploadQueuePolicyPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/upload-queue")({
	component: UploadQueuePolicyPage,
});
