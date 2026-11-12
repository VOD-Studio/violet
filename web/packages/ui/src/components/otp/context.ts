import { createContext, useContext } from "react";
import type { OTPNativeProps } from "./types";
import type { OTPModel } from "./use-otp";

interface OTPContextValue extends OTPModel {
	id: string;
	length: number;
	disabled: boolean;
	readOnly: boolean;
	invalid: OTPNativeProps["aria-invalid"];
	describedBy?: string;
	form?: string;
	nativeProps: OTPNativeProps;
}

export const OTPContext = createContext<OTPContextValue | null>(null);

export function useOTPContext() {
	const context = useContext(OTPContext);
	if (!context) throw new Error("InputOTPSlot must be inside InputOTP");
	return context;
}
