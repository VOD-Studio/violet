import { activePersonaKeys } from "@entities/persona/api/keys";
import { fetchActivePersona } from "@entities/persona/api/queries";
import type { PublicPersona } from "@entities/persona/model/types";
import { PersonaPage } from "@features/persona-browse/ui/PersonaPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/persona")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData({
			queryKey: activePersonaKeys.current(),
			queryFn: fetchActivePersona,
		}),
	head: ({ loaderData }) => {
		const persona = loaderData as PublicPersona | null;
		const siteUrl = SITE_URL.replace(/\/+$/, "");
		if (!persona) {
			return {
				meta: [{ title: "人设" }],
				links: [{ rel: "canonical", href: `${siteUrl}/persona` }],
			};
		}
		const firstImage = persona.images[0]?.url;
		const imageUrl = firstImage
			? firstImage.startsWith("http")
				? firstImage
				: `${siteUrl}${firstImage}`
			: null;
		return {
			meta: [
				{ title: `${persona.name} · 人设` },
				{ name: "description", content: persona.summary },
				{ property: "og:title", content: persona.name },
				{ property: "og:description", content: persona.summary },
				...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
				{ property: "og:type", content: "profile" },
				{ property: "og:url", content: `${siteUrl}/persona` },
			],
			links: [{ rel: "canonical", href: `${siteUrl}/persona` }],
		};
	},
	component: PersonaPage,
});
