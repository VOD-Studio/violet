import { createFileRoute } from "@tanstack/react-router";

import MusicPage from "@/pages/Music";

export const Route = createFileRoute("/_public/music")({
  component: MusicPage,
});
