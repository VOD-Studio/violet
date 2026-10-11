import { EmbeddedTweet } from "@violetjs/react-tweet";
import { saved } from "./snapshot";

export function Themes({ locale = "en-US" }: { locale?: string }) {
	return (
		<div style={{ display: "flex", gap: 20, padding: 20, width: 1000, background: "#f0f1f3" }}>
			<EmbeddedTweet tweet={saved} data-theme="light" locale={locale} />
			<EmbeddedTweet tweet={saved} data-theme="dark" locale={locale} />
		</div>
	);
}
