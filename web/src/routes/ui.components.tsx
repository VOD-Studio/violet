import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ui/components")({
	component: ComponentsLayout,
});

function ComponentsLayout() {
	return <Outlet />;
}
