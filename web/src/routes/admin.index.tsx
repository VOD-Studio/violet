import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
	component: AdminIndex,
});

function AdminIndex() {
	return (
		<div className="space-y-4">
			<h2 className="text-2xl font-bold">Welcome to Admin Dashboard</h2>
			<p className="text-neutral-500">Select a module from the sidebar to manage.</p>
		</div>
	);
}
