import { createFileRoute, redirect } from "@tanstack/react-router";
import ProfilePage from "@/pages/profile";
import { useAuthStore } from "@/store";

export const Route = createFileRoute("/_public/profile")({
  beforeLoad: () => {
    const { token, expiresAt } = useAuthStore.getState();
    const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: ProfilePage,
});
