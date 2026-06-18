import { createFileRoute } from "@tanstack/react-router";
import VerifyEmail from "@/pages/VerifyEmail";

export const Route = createFileRoute("/_auth/verify-email")({
  component: VerifyEmail,
});
