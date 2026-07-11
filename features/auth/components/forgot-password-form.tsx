"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordValues) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    setMessage(
      data.message ?? "If an account exists, we've sent a reset link."
    );
  }

  if (message) {
    return (
      <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
        <CheckCircle2 className="text-navy dark:text-blue-accent size-8" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@university.edu"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-destructive text-sm">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        loading={isSubmitting}
        className="bg-navy hover:bg-navy/90 w-full text-white"
      >
        Send reset link
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-foreground font-medium underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
