import { activePersonaKeys } from "@entities/persona/api/keys";
import { fetchActivePersona } from "@entities/persona/api/queries";
import type { PublicPersona } from "@entities/persona/model/types";
import { PersonaPage } from "@features/persona-browse/ui/PersonaPage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

interface PersonaSearch {
	lang?: string;
}

function parsePersonaSearch(search: Record<string, unknown>): PersonaSearch {
	const lang = typeof search.lang === "string" ? search.lang.trim() : "";
	return { lang: lang && lang.length <= 35 ? lang : undefined };
}

export const Route = createFileRoute("/persona")({
	validateSearch: parsePersonaSearch,
	loaderDeps: ({ search }) => ({ locale: search.lang ?? "" }),
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData({
			queryKey: activePersonaKeys.current(deps.locale),
			queryFn: () => fetchActivePersona(deps.locale),
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
		const localeSearch =
			persona.locale === persona.default_locale
				? ""
				: `?lang=${encodeURIComponent(persona.locale)}`;
		const canonicalUrl = `${siteUrl}/persona${localeSearch}`;
		return {
			meta: [
				{ title: `${persona.name} · 人设` },
				{ name: "description", content: persona.summary },
				{ property: "og:title", content: persona.name },
				{ property: "og:description", content: persona.summary },
				...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
				{ property: "og:type", content: "profile" },
				{ property: "og:url", content: canonicalUrl },
			],
			links: [{ rel: "canonical", href: canonicalUrl }],
		};
	},
	component: PersonaRoute,
});

function PersonaRoute() {
	const { lang } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<PersonaPage
			locale={lang ?? ""}
			onLocaleChange={(locale, defaultLocale) =>
				void navigate({
					search: locale === defaultLocale ? {} : { lang: locale },
					replace: true,
					resetScroll: false,
				})
			}
		/>
	);
}
