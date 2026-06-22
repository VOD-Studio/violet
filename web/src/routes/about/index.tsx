import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute } from "@tanstack/react-router";

const AboutPage = () => <ComingSoon title="关于" />;

export const Route = createFileRoute("/about/")({
	component: AboutPage,
});
