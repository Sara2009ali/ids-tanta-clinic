import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in — Dentra",
};

export default function LoginPage() {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold">
          D
        </div>
        <CardTitle className="text-xl">Dentra</CardTitle>
        <CardDescription>Sign in to the clinic management system</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
