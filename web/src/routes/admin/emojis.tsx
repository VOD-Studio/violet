import { createFileRoute } from "@tanstack/react-router";
import Emojis from "@/pages/admin/Emojis";

export const Route = createFileRoute("/admin/emojis")({
  component: Emojis,
});
