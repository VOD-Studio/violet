import { ApiError } from "@shared/api/error";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSendFriendLinkCode } from "../api/queries";

export interface ApplicationVerification {
	code: string;
	sent: boolean;
	error: string;
	invalid: boolean;
	onChange: (value: string) => void;
	onResend: () => Promise<boolean>;
	changeEmail: (value: string) => void;
	onReject: (reason: unknown) => boolean;
	reset: () => void;
}

/** 管理一次匿名申请的邮箱验证码，隔离换邮箱和关闭弹窗前的发送结果。 */
export function useApplicationVerification(
	email: string,
	onEmailChange: (email: string) => void,
): ApplicationVerification {
	const [code, setCode] = useState("");
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");
	const [invalid, setInvalid] = useState(false);
	const session = useRef(0);
	const send = useSendFriendLinkCode();
	const currentSession = session.current;

	const reset = () => {
		session.current += 1;
		setCode("");
		setSent(false);
		setError("");
		setInvalid(false);
	};

	const changeEmail = (value: string) => {
		reset();
		onEmailChange(value);
	};

	const onChange = (value: string) => {
		setCode(value);
		setInvalid(false);
		if (value) setError("");
	};

	const onResend = async (): Promise<boolean> => {
		if (!email.includes("@")) return false;
		const requestSession = session.current;
		try {
			await send.mutateAsync({ email: email.trim() });
			if (requestSession !== session.current) return false;
			setCode("");
			setError("");
			setInvalid(false);
			setSent(true);
			return true;
		} catch (reason) {
			if (requestSession !== session.current) return false;
			toast.error(reason instanceof Error ? reason.message : "发送失败，请重试");
			return false;
		}
	};

	const onReject = (reason: unknown) => {
		if (
			currentSession === session.current &&
			reason instanceof ApiError &&
			reason.code === "BAD_REQUEST" &&
			reason.message === "验证码错误或已过期"
		) {
			setError(reason.message);
			setInvalid(true);
			return true;
		}
		return false;
	};

	return { code, sent, error, invalid, onChange, onResend, changeEmail, onReject, reset };
}
