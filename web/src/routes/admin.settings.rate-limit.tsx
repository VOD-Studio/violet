import { RateLimitPolicyPage } from "@features/admin-settings/ui/RateLimitPolicyPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/rate-limit")({
	component: RateLimitPolicyPage,
});
