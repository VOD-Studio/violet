import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/design-system/specimens")({
	component: SpecimensLayout,
});

function SpecimensLayout() {
	return <Outlet />;
}
