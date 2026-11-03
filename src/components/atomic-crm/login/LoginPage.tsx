import { useEffect, useRef, useState } from "react";
import { Form, required, useLogin, useNotify, useTranslate } from "ra-core";
import type { SubmitHandler, FieldValues } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Notification } from "@/components/admin/notification";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext.tsx";
// The shop's lockup (mark + LUXX AUTOMOTIVE BOUTIQUE INC.), not a text label
import wordmark from "../root/logos/the_lab_logo_white.png";
import { SSOAuthButton } from "./SSOAuthButton";
import {
  disableEmailPasswordAuthentication,
  googleWorkplaceDomain,
} from "./authConfig";

/**
 * Login page displayed when authentication is enabled and the user is not authenticated.
 *
 * Automatically shown when an unauthenticated user tries to access a protected route.
 * Handles login via authProvider.login() and displays error notifications on failure.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/loginpage LoginPage documentation}
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/security Security documentation}
 */
export const LoginPage = (props: { redirectTo?: string }) => {
  const { darkModeLogo, title } = useConfigurationContext();
  const { redirectTo } = props;
  const [loading, setLoading] = useState(false);
  const hasDisplayedRecoveryNotification = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLogin();
  const notify = useNotify();
  const translate = useTranslate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldNotify = searchParams.get("passwordRecoveryEmailSent") === "1";

    if (!shouldNotify || hasDisplayedRecoveryNotification.current) {
      return;
    }

    hasDisplayedRecoveryNotification.current = true;
    notify("crm.auth.recovery_email_sent", {
      type: "success",
      messageArgs: {
        _: "If you're a registered user, you should receive a password recovery email shortly.",
      },
    });

    searchParams.delete("passwordRecoveryEmailSent");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, notify]);

  const handleSubmit: SubmitHandler<FieldValues> = (values) => {
    setLoading(true);
    login(values, redirectTo)
      .then(() => {
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        notify(
          typeof error === "string"
            ? error
            : typeof error === "undefined" || !error.message
              ? "ra.auth.sign_in_error"
              : error.message,
          {
            type: "error",
            messageArgs: {
              _:
                typeof error === "string"
                  ? error
                  : error && error.message
                    ? error.message
                    : undefined,
            },
          },
        );
      });
  };

  return (
    <div className="min-h-screen flex">
      <div className="relative grid w-full lg:grid-cols-2">
        {/* The shop's ink, with the lockup large enough to read: the mark alone
            at 40px was a hairline, and the app name was printed beside it. */}
        <div className="relative hidden h-full flex-col justify-between overflow-hidden bg-[var(--lab-bg)] p-10 text-white lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-40 size-[32rem] rounded-full bg-[var(--lab-blue)]/25 blur-[130px]"
          />
          <img
            src={wordmark}
            alt={title}
            className="relative z-20 h-16 w-auto self-start"
          />
          <div className="relative z-20 space-y-3">
            <p className="max-w-xs text-2xl font-semibold leading-snug">
              The shop, in one place.
            </p>
            <p className="max-w-xs text-sm text-white/55">
              Bookings, customers, jobs and money — from drop-off to pickup.
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-center w-full p-4 lg:p-8">
          <div className="w-full space-y-6 lg:mx-auto lg:w-[350px]">
            <div className="flex justify-center lg:hidden">
              <img className="h-12 w-auto" src={darkModeLogo} alt={title} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                {translate("ra.auth.sign_in")}
              </h1>
            </div>
            {disableEmailPasswordAuthentication ? null : (
              <Form className="space-y-8" onSubmit={handleSubmit}>
                <TextInput
                  label="ra.auth.email"
                  source="email"
                  type="email"
                  validate={required()}
                />
                <TextInput
                  label="ra.auth.password"
                  source="password"
                  type="password"
                  validate={required()}
                />
                <div className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="cursor-pointer"
                    disabled={loading}
                  >
                    {translate("ra.auth.sign_in")}
                  </Button>
                </div>
              </Form>
            )}
            {googleWorkplaceDomain ? (
              <SSOAuthButton className="w-full" domain={googleWorkplaceDomain}>
                {translate("crm.auth.sign_in_google_workspace", {
                  _: "Sign in with Google Workplace",
                })}
              </SSOAuthButton>
            ) : null}
            {disableEmailPasswordAuthentication ? null : (
              <Link
                to={"/forgot-password"}
                className="block text-sm text-center hover:underline"
              >
                {translate("ra-supabase.auth.forgot_password", {
                  _: "Forgot password?",
                })}
              </Link>
            )}
          </div>
        </div>
      </div>
      <Notification />
    </div>
  );
};
