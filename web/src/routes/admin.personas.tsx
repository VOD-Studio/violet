import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/personas")({
	component: PersonaAdminLayout,
});

function PersonaAdminLayout() {
	return <Outlet />;
}
