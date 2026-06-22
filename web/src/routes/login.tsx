import ComingSoon from "@shared/ui/coming-soon";
import { createFileRoute } from "@tanstack/react-router";

const LoginPage = () => <ComingSoon title="登录" />;

export const Route = createFileRoute("/login")({
	component: LoginPage,
});
