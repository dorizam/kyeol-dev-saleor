import { useEffect, useState } from "react";
import { bool, object, type Schema, string } from "yup";
import { useUserRegisterMutation } from "@/checkout/graphql";
import { useCheckout } from "@/checkout/hooks/useCheckout";
import {
	useCheckoutUpdateStateActions,
	useCheckoutUpdateStateChange,
	useUserRegisterState,
} from "@/checkout/state/updateStateStore";
import { useCheckoutFormValidationTrigger } from "@/checkout/hooks/useCheckoutFormValidationTrigger";
import { type ChangeHandler, useForm } from "@/checkout/hooks/useForm";
import { getCurrentHref } from "@/checkout/lib/utils/locale";
import { useCheckoutEmailUpdate } from "@/checkout/sections/GuestUser/useCheckoutEmailUpdate";
import { useErrorMessages } from "@/checkout/hooks/useErrorMessages";
import { useUser } from "@/checkout/hooks/useUser";
import { isValidEmail } from "@/checkout/lib/utils/common";
import { useGuestUserFormStore } from "@/checkout/sections/GuestUser/useGuestUserFormStore";

export interface GuestUserFormData {
	email: string;
	password: string;
	createAccount: boolean;
}

interface GuestUserFormProps {
	// shared between sign in form and guest user form
	initialEmail: string;
}

export const useGuestUserForm = ({ initialEmail }: GuestUserFormProps) => {
	const { checkout } = useCheckout();
	const { user } = useUser();
	const shouldUserRegister = useUserRegisterState();
	const { setShouldRegisterUser, setSubmitInProgress } = useCheckoutUpdateStateActions();
	const { errorMessages } = useErrorMessages();
	const { setCheckoutUpdateState: setRegisterState } = useCheckoutUpdateStateChange("userRegister");
	const [, userRegister] = useUserRegisterMutation();
	const [userRegisterDisabled, setUserRegistrationDisabled] = useState(false);
	const { setCheckoutUpdateState } = useCheckoutUpdateStateChange("checkoutEmailUpdate");

	const validationSchema = object({
		createAccount: bool(),
		email: string().email(errorMessages.invalid).required(errorMessages.required),
		password: string().when(["createAccount"], ([createAccount], field) =>
			createAccount ? field.min(8, "Password must be at least 8 characters").required() : field,
		),
	}) as Schema<GuestUserFormData>;

	const defaultFormData: GuestUserFormData = {
		email: initialEmail || checkout.email || "",
		password: "",
		createAccount: false,
	};

	const onSubmit = async (data: GuestUserFormData) => {
		setShouldRegisterUser(false);
		setSubmitInProgress(true);

		const input = {
			email: data.email,
			password: data.password,
			channel: checkout.channel.slug,
			redirectUrl: getCurrentHref(),
		};

		// userRegister expects { input: AccountRegisterInput }
		const result = await userRegister({ input });

		const errors = result.data?.accountRegister?.errors || [];

		if (errors.length > 0) {
			setSubmitInProgress(false);
			const uniqueError = errors.find((e: any) => e.code === "UNIQUE");
			if (uniqueError) {
				setUserRegistrationDisabled(true);
				setTimeout(() => setRegisterState("success"), 100);
			}
			// Mimic useFormSubmit return structure if needed, or simple return
			return;
		}

		setSubmitInProgress(false);
		setUserRegistrationDisabled(true);

		// Save credentials to store so DummyComponent can use them for signIn/customerAttach
		const { setCredentials } = useGuestUserFormStore.getState();
		setCredentials(data.email, data.password);
		console.log("[GuestUserForm] Credentials saved to store for:", data.email);

		// Signal success after a small delay to ensure Store is updated before useEffect triggers
		// DummyComponent will handle signIn and customerAttach before processing payment
		setTimeout(() => {
			console.log("[GuestUserForm] Triggering setRegisterState success");
			setRegisterState("success");
		}, 100);
	};

	const form = useForm<GuestUserFormData>({
		initialValues: defaultFormData,
		onSubmit,
		validationSchema,
		validateOnChange: true,
		validateOnBlur: false,
		initialTouched: { email: true },
	});

	const {
		values: { email, createAccount },
		handleSubmit,
		handleChange,
	} = form;

	useCheckoutFormValidationTrigger({
		scope: "guestUser",
		form,
	});

	useEffect(() => {
		if (!shouldUserRegister || user || !createAccount || userRegisterDisabled) {
			return;
		}

		void handleSubmit();
	}, [createAccount, handleSubmit, shouldUserRegister, user, userRegisterDisabled]);

	useCheckoutEmailUpdate({ email });

	// since we use debounced submit, set update
	// state as "loading" right away
	const onChange: ChangeHandler = async (event) => {
		handleChange(event);

		if (event.target.name === "email") {
			setUserRegistrationDisabled(false);
		}

		const error = await isValidEmail(event.target.value as string);

		if (!error) {
			setCheckoutUpdateState("loading");
		}
	};

	return { ...form, handleChange: onChange };
};
