"use client";
import { useState, useEffect } from "react";

import { dummyGatewayId } from "./types";
import { Button } from "@/checkout/components";
import { useTransactionInitializeMutation, useCheckoutCustomerAttachMutation } from "@/checkout/graphql";
import { useAlerts } from "@/checkout/hooks/useAlerts";
import { useCheckout } from "@/checkout/hooks/useCheckout";
import { useCheckoutComplete } from "@/checkout/hooks/useCheckoutComplete";
import { useCheckoutUpdateStateActions, useCheckoutUpdateState } from "@/checkout/state/updateStateStore";
import { useCheckoutValidationActions } from "@/checkout/state/checkoutValidationStateStore";
import { useUser } from "@/checkout/hooks/useUser";
import { useSaleorAuthContext } from "@saleor/auth-sdk/react";
import { useGuestUserFormStore } from "@/checkout/sections/GuestUser/useGuestUserFormStore";

// Basic implementation of the test gateway:
// https://github.com/saleor/dummy-payment-app/

export const DummyComponent = () => {
	const { showCustomErrors } = useAlerts();

	const { checkout } = useCheckout();
	const [transactionInitializeState, transactionInitialize] = useTransactionInitializeMutation();
	const { onCheckoutComplete, completingCheckout } = useCheckoutComplete()
	const { setShouldRegisterUser } = useCheckoutUpdateStateActions();
	const { updateState } = useCheckoutUpdateState();
	const checkoutUpdateState = updateState.userRegister;
	const { validateAllForms } = useCheckoutValidationActions();
	const { authenticated } = useUser();
	const [isWaitingForRegistration, setIsWaitingForRegistration] = useState(false);
	const isInProgress = completingCheckout || transactionInitializeState.fetching;

	// Auth hooks for signIn and customerAttach
	const { signIn } = useSaleorAuthContext();
	const [, customerAttach] = useCheckoutCustomerAttachMutation();

	useEffect(() => {
		if (isWaitingForRegistration) {
			if (checkoutUpdateState === "success") {
				setIsWaitingForRegistration(false);

				// Poll for credentials in store (may take a moment to be set)
				const waitForCredentials = async (): Promise<{ email: string, password: string } | null> => {
					const maxAttempts = 10;
					for (let i = 0; i < maxAttempts; i++) {
						const formData = useGuestUserFormStore.getState();
						console.log(`[DummyComponent] Polling attempt ${i + 1}:`, {
							email: formData?.email,
							password: formData?.password ? "[REDACTED]" : undefined
						});
						if (formData?.email && formData?.password) {
							return { email: formData.email, password: formData.password };
						}
						await new Promise(resolve => setTimeout(resolve, 100));
					}
					return null;
				};

				const proceedWithPayment = async () => {
					// Wait for credentials to be available
					const credentials = await waitForCredentials();

					// Sign in and attach customer if we have credentials
					if (credentials) {
						try {
							console.log("[DummyComponent] Starting signIn for:", credentials.email);
							await signIn({ email: credentials.email, password: credentials.password });
							console.log("[DummyComponent] signIn complete, attaching customer...");

							// Small delay for token propagation
							await new Promise(resolve => setTimeout(resolve, 300));

							const attachResult = await customerAttach({
								checkoutId: checkout.id,
								languageCode: "EN_US" as any
							});
							console.log("[DummyComponent] customerAttach result:", attachResult);

							if (attachResult.data?.checkoutCustomerAttach?.errors?.length) {
								console.error("[DummyComponent] customerAttach errors:",
									attachResult.data.checkoutCustomerAttach.errors);
							} else {
								console.log("[DummyComponent] Customer attached successfully!");
							}
						} catch (e) {
							console.error("[DummyComponent] signIn or customerAttach failed:", e);
						}
					}

					// Now proceed with payment
					try {
						await transactionInitialize({
							checkoutId: checkout.id,
							paymentGateway: {
								id: dummyGatewayId,
								data: {
									event: {
										includePspReference: true,
										type: "CHARGE_SUCCESS",
									},
								},
							},
						});
						const res = await onCheckoutComplete();
						if (res?.apiErrors) {
							res.apiErrors.forEach((error) => {
								showCustomErrors([{ message: error.message }]);
							});
						}
					} catch (err) {
						console.error("There was a problem with Dummy Payment Gateway:", err);
					}
				};

				void proceedWithPayment();
			}
		}
	}, [
		isWaitingForRegistration,
		checkoutUpdateState,
		checkout.id,
		transactionInitialize,
		onCheckoutComplete,
		showCustomErrors,
		signIn,
		customerAttach,
	]);

	const onInitalizeClick = () => {
		// If creating account and guest, trigger registration and wait
		// createAccount option is handled in GuestUser form which reacts to setShouldRegisterUser
		if (!authenticated) {
			// We can't easily check 'createAccount' checkbox state here directly without more hook wiring,
			// but triggering setShouldRegisterUser(true) is safe (GuestUserForm checks createAccount internally)

			// Warning: We need to know if we SHOULD wait. 
			// Ideally we check if createAccount is checked.
			// But createAccount state is local to useGuestUserForm logic (via useCheckoutUpdateStateStore?)
			// GuestUserForm logic: useEffect checks 'shouldUserRegister' and 'createAccount'.

			// For simplicity in this dummy component: 
			// We always fire register logic. 
			// Use a flag to decide if we proceed immediately or wait.

			setShouldRegisterUser(true);
			validateAllForms(authenticated);
			setIsWaitingForRegistration(true);
			return;
		}

		validateAllForms(authenticated);

		void transactionInitialize({
			checkoutId: checkout.id,
			paymentGateway: {
				id: dummyGatewayId,
				data: {
					"event": {
						"includePspReference": true,
						"type": "CHARGE_SUCCESS"
					}
				},
			},
		}).catch((err) => {
			console.error("There was a problem with Dummy Payment Gateway:", err);
		}).then((_) => {
			return onCheckoutComplete()
		}).then((res) => {
			if (res?.apiErrors) {
				res.apiErrors.forEach((error) => {
					showCustomErrors([{ message: error.message }]);
				});
			}
		})
	}

	if (isInProgress) {
		return <Button variant="primary" disabled={true} label="Processing payment..." />
	}

	return (
		<Button variant="primary" onClick={onInitalizeClick} label="Make payment and create order" />
	);
};
