import { createFileRoute } from "@tanstack/react-router";

import AboutPage from "@/pages/About";

export const Route = createFileRoute("/_public/about")({
  component: AboutPage,
});
