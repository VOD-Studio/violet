import { useUpdateProfile } from "@features/auth/api/mutations";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Field,
	Input,
} from "@violet/ui";
import { useState } from "react";
import type { PublicProfile } from "../model/public-profile";

/** 公开字段独立保存；未填写的偏好不会从阅读历史补全。 */
export function PublicPreferencesDialog({ profile }: { profile: PublicProfile }) {
	const [open, setOpen] = useState(false);
	const [location, setLocation] = useState(profile.location);
	const [website, setWebsite] = useState(profile.website);
	const [topics, setTopics] = useState(profile.public_reading_preferences.join("，"));
	const [error, setError] = useState("");
	const update = useUpdateProfile();
	const dirty =
		location !== profile.location ||
		website !== profile.website ||
		topics !== profile.public_reading_preferences.join("，");
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setLocation(profile.location);
					setWebsite(profile.website);
					setTopics(profile.public_reading_preferences.join("，"));
					setError("");
				}
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm">
					编辑公开偏好
				</Button>
			</DialogTrigger>
			<DialogContent dirty={dirty}>
				<DialogHeader>
					<DialogTitle>公开资料与常读</DialogTitle>
					<DialogDescription>
						保存后所有访客可见。常读仅展示你主动填写的主题，不会读取或公开阅读历史。
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={async (event) => {
						event.preventDefault();
						setError("");
						try {
							await update.mutateAsync({
								location,
								website,
								public_reading_preferences: topics
									.split(/[,，\n]/)
									.map((value) => value.trim())
									.filter(Boolean),
							});
							setOpen(false);
						} catch (error) {
							setError(error instanceof Error ? error.message : "保存失败，请重试");
						}
					}}
				>
					<Field label="所在地" optional>
						<Input
							maxLength={100}
							value={location}
							onChange={(event) => setLocation(event.target.value)}
						/>
					</Field>
					<Field label="网站" optional>
						<Input
							type="url"
							maxLength={2048}
							placeholder="https://example.com"
							value={website}
							onChange={(event) => setWebsite(event.target.value)}
						/>
					</Field>
					<Field
						label="常读主题"
						optional
						hint="用逗号分隔，最多 8 项，每项最多 30 字。清空后不再公开任何主题。"
					>
						<Input value={topics} onChange={(event) => setTopics(event.target.value)} />
					</Field>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="submit" loading={update.isPending}>
							保存公开资料
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
