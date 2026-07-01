import type { Metadata } from "next";

import { AuthForm } from "@/components/day-of-music/auth-form";

export const metadata: Metadata = {
  title: "Sign up — Day of Music",
};

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
