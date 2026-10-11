import { TweetCard } from "@violetjs/react-tweet";

export function Note() {
	return (
		<TweetCard
			aria-label="Studio note"
			headerSlot={<strong>Ink Club</strong>}
			contentSlot={<p>Bring a sketchbook. We will bring the coffee.</p>}
			footerSlot={<time dateTime="2026-10-16">October 16, 2026</time>}
		/>
	);
}
