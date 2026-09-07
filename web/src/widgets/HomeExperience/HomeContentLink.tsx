import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { HomePublicationItem } from "./types";

interface HomeContentLinkProps {
	item: HomePublicationItem;
	className?: string;
	children: ReactNode;
}

export function HomeContentLink({ item, className, children }: HomeContentLinkProps) {
	switch (item.kind) {
		case "article":
			return (
				<Link to="/blog/$slug" params={{ slug: item.route_key }} className={className}>
					{children}
				</Link>
			);
		case "note":
			return (
				<Link to="/notes/$id" params={{ id: item.route_key }} className={className}>
					{children}
				</Link>
			);
		case "gallery":
			return (
				<Link to="/galleries/$slug" params={{ slug: item.route_key }} className={className}>
					{children}
				</Link>
			);
	}
}
