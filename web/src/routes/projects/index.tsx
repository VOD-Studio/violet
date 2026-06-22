import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute } from "@tanstack/react-router";

const ProjectsPage = () => <ComingSoon title="项目" />;

export const Route = createFileRoute("/projects/")({
	component: ProjectsPage,
});
