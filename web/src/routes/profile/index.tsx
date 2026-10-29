import { useMe } from "@features/auth/api/queries";
import { requireLogin } from "@features/auth/lib/require-login";
import { AccountInfoSection } from "@features/profile/ui/AccountInfoSection";
import { ConnectionsSection } from "@features/profile/ui/ConnectionsSection";
import { PasswordSection } from "@features/profile/ui/PasswordSection";
import { ProfileCoverSection } from "@features/profile/ui/ProfileCoverSection";
import { ProfileInfoSection } from "@features/profile/ui/ProfileInfoSection";
import { ProfileShell } from "@features/profile/ui/ProfileShell";
import { UsageSection } from "@features/profile/ui/UsageSection";
import { createFileRoute } from "@tanstack/react-router";

const ProfilePage = () => {
	const { data: user } = useMe();

	if (!user) {
		return null; // beforeLoad 已拦截未登录
	}

	return (
		<ProfileShell
			user={user}
			usage={<UsageSection />}
			profile={
				<div className="space-y-6">
					<ProfileInfoSection user={user} />
					<ProfileCoverSection user={user} />
				</div>
			}
			security={
				<div className="space-y-6">
					<AccountInfoSection user={user} />
					<ConnectionsSection user={user} />
					<PasswordSection hasPassword={user.has_password} />
				</div>
			}
		/>
	);
};

/** 未登录时跳转登录页，并携带原页面作为回跳地址。 */
export const Route = createFileRoute("/profile/")({
	ssr: false,
	beforeLoad: requireLogin,
	component: ProfilePage,
});
