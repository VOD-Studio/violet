import { createFileRoute } from "@tanstack/react-router";
import Playlists from "@/pages/admin/Playlists";

export const Route = createFileRoute("/admin/playlists")({
  component: Playlists,
});
