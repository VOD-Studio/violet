import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Home, Smile, Users } from "lucide-react";

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
});

function AdminLayout() {
	return (
		<div className="flex h-screen w-full bg-neutral-100 dark:bg-neutral-900">
			<aside className="w-64 flex-shrink-0 border-r bg-white dark:bg-neutral-950 p-4 flex flex-col gap-2">
				<h2 className="text-xl font-bold mb-4 px-2">Admin Panel</h2>
				<Link
					to="/admin"
					className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700"
				>
					<Home className="w-4 h-4" /> Dashboard
				</Link>
				<Link
					to={"/admin/users" as string & {}}
					className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700"
				>
					<Users className="w-4 h-4" /> Users
				</Link>
				<Link
					to={"/admin/emojis" as string & {}}
					className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700"
				>
					<Smile className="w-4 h-4" /> Emojis
				</Link>
			</aside>
			<main className="flex-1 flex flex-col min-w-0 overflow-hidden">
				<header className="h-14 border-b bg-white dark:bg-neutral-950 flex items-center px-4 shrink-0">
					<h1 className="font-semibold">Management</h1>
				</header>
				<div className="flex-1 overflow-auto p-6">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
