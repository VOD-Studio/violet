import { Button } from "@violet/ui";

import { Palette } from "lucide-react";

interface ChatAppearanceButtonProps {
	active: boolean;
	onClick: () => void;
}

export function ChatAppearanceButton({ active, onClick }: ChatAppearanceButtonProps) {
	return (
		<Button
			size="icon"
			variant="ghost"
			aria-label="聊天外观"
			aria-pressed={active}
			title="聊天外观"
			className={active ? "bg-secondary text-foreground" : "text-muted-foreground"}
			onClick={onClick}
		>
			<Palette aria-hidden="true" className="size-5" />
		</Button>
	);
}
