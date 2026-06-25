import type { UserRole } from "@entities/user/model/types";
import { useUpdateUserRole } from "@features/admin-users/api/mutations";
import type { AdminUser } from "@features/admin-users/model/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { toast } from "sonner";

const ROLES: { value: UserRole; label: string }[] = [
	{ value: "user", label: "用户" },
	{ value: "admin", label: "管理员" },
	{ value: "superadmin", label: "超级管理员" },
];

interface UserRoleCellProps {
	user: AdminUser;
	onMutated: () => void;
}

/**
 * UserRoleCell - 用户角色单元格
 *
 * 支持下拉切换用户角色。
 */
export function UserRoleCell({ user, onMutated }: UserRoleCellProps) {
	const updateRole = useUpdateUserRole(user.id);

	return (
		<Select
			value={user.role}
			onValueChange={(v) => {
				updateRole.mutate(
					{ role: v as UserRole },
					{
						onSuccess: () => {
							toast.success("角色已更新");
							onMutated();
						},
						onError: (err) => toast.error(err.message),
					},
				);
			}}
			disabled={updateRole.isPending}
		>
			<SelectTrigger className="h-8 w-32">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{ROLES.map((r) => (
					<SelectItem key={r.value} value={r.value}>
						{r.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
