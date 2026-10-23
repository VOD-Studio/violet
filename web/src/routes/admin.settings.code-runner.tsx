import { CodeRunnerPolicyPage } from "@features/admin-settings/ui/CodeRunnerPolicyPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/code-runner")({
	component: CodeRunnerPolicyPage,
});
