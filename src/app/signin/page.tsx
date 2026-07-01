import type { Metadata } from "next";

import { AuthForm } from "@/components/day-of-music/auth-form";

export const metadata: Metadata = {
  title: "Sign in — Day of Music",
};

export default function SignInPage() {
  return <AuthForm mode="signin" />;
}
