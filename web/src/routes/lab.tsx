import "@features/lab/lab-tokens.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/lab")({
	component: LabLayout,
});

function LabLayout() {
	return (
		<div className="lab-scope flex flex-1 flex-col" data-lab-scope>
			<Outlet />
		</div>
	);
}
