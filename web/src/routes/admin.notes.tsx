import { authKeys } from "@features/auth/api/keys";
import { fetchMe } from "@features/auth/api/queries";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/notes")({
	beforeLoad: async ({ context }) => {
		const me = await context.queryClient.ensureQueryData({
			queryKey: authKeys.me(),
			queryFn: fetchMe,
			staleTime: Infinity,
		});
		const permissions = me?.permissions ?? [];
		if (!permissions.includes("*") && !permissions.includes("note:view")) {
			throw redirect({ to: "/admin", replace: true });
		}
	},
	component: NotesAdminLayout,
});

function NotesAdminLayout() {
	return <Outlet />;
}
