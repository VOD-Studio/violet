import { useId } from "react";

import type { TweetVerification } from "../data/author.ts";
import type { TweetMessages } from "./localization.ts";

const individualPath =
	"M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z";
const governmentPath =
	"M12.05 2.056c-.568-.608-1.532-.608-2.1 0l-1.393 1.49c-.284.303-.685.47-1.1.455L5.42 3.932c-.832-.028-1.514.654-1.486 1.486l.069 2.039c.014.415-.152.816-.456 1.1l-1.49 1.392c-.608.568-.608 1.533 0 2.101l1.49 1.393c.304.284.47.684.456 1.1l-.07 2.038c-.027.832.655 1.514 1.487 1.486l2.038-.069c.415-.014.816.152 1.1.455l1.392 1.49c.569.609 1.533.609 2.102 0l1.393-1.49c.283-.303.684-.47 1.099-.455l2.038.069c.832.028 1.515-.654 1.486-1.486L18 14.542c-.015-.415.152-.815.455-1.099l1.49-1.393c.608-.568.608-1.533 0-2.101l-1.49-1.393c-.303-.283-.47-.684-.455-1.1l.068-2.038c.029-.832-.654-1.514-1.486-1.486l-2.038.07c-.415.013-.816-.153-1.1-.456zm-5.817 9.367l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z";

export function VerifiedBadge({
	kind,
	messages,
}: {
	kind: TweetVerification;
	messages: TweetMessages;
}) {
	if (kind === "business") return <BusinessBadge label={messages.verifiedBusiness} />;
	return (
		<svg
			className="v-tweet__verified"
			data-kind={kind}
			role="img"
			aria-label={kind === "government" ? messages.verifiedGovernment : messages.verified}
			viewBox={kind === "government" ? "0 0 22 22" : "0 0 24 24"}
			width="18"
			height="18"
			fill="currentColor"
		>
			<path
				d={kind === "government" ? governmentPath : individualPath}
				fillRule="evenodd"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function BusinessBadge({ label }: { label: string }) {
	const id = useId();
	return (
		<svg
			className="v-tweet__verified"
			data-kind="business"
			role="img"
			aria-label={label}
			viewBox="0 0 22 22"
			width="18"
			height="18"
		>
			<defs>
				<linearGradient
					id={`${id}-outer`}
					gradientUnits="userSpaceOnUse"
					x1="4.411"
					x2="18.083"
					y1="2.495"
					y2="21.508"
				>
					<stop offset="0" stopColor="#f4e72a" />
					<stop offset=".539" stopColor="#cd8105" />
					<stop offset=".68" stopColor="#cb7b00" />
					<stop offset="1" stopColor="#f4e72a" />
				</linearGradient>
				<linearGradient
					id={`${id}-inner`}
					gradientUnits="userSpaceOnUse"
					x1="5.355"
					x2="16.361"
					y1="3.395"
					y2="19.133"
				>
					<stop offset="0" stopColor="#f9e87f" />
					<stop offset=".406" stopColor="#e2b719" />
					<stop offset=".989" stopColor="#e2b719" />
				</linearGradient>
			</defs>
			<g clipRule="evenodd" fillRule="evenodd">
				<path
					d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"
					fill={`url(#${id}-outer)`}
				/>
				<path
					d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"
					fill={`url(#${id}-inner)`}
				/>
				<path
					d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z"
					fill="#d18800"
				/>
			</g>
		</svg>
	);
}
