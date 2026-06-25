import { useCreateRole } from "@features/admin-roles/api/mutations";
import { Button } from "@shared/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface CreateRoleFormProps {
	onCreated: () => void;
}

/**
 * CreateRoleForm - 创建角色表单
 */
export function CreateRoleForm({ onCreated }: CreateRoleFormProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const createRole = useCreateRole();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createRole.mutate(
			{ name, description },
			{
				onSuccess: () => {
					toast.success("角色创建成功");
					onCreated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>新建角色</DialogTitle>
				<DialogDescription>输入角色名称与描述。</DialogDescription>
			</DialogHeader>
			<div className="space-y-3 py-4">
				<div className="space-y-1">
					<Label>名称</Label>
					<Input value={name} onChange={(e) => setName(e.target.value)} required />
				</div>
				<div className="space-y-1">
					<Label>描述</Label>
					<Input value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createRole.isPending}>
					创建
				</Button>
			</DialogFooter>
		</form>
	);
}
