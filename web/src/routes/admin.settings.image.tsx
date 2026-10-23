import { ImagePolicyPage } from "@features/admin-settings/ui/ImagePolicyPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/image")({
	component: ImagePolicyPage,
});
