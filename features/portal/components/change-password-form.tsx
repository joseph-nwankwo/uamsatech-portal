"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(values: ChangePasswordValues) {
    setFormError(null);
    setSuccess(false);
    const response = await fetch("/api/portal/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();

    if (!response.ok) {
      setFormError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setSuccess(true);
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
      {formError && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {formError}
        </p>
      )}
      {success && (
        <p className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm">
          Password changed. Other sessions have been signed out.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p className="text-destructive text-sm">
            {errors.currentPassword.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" {...register("newPassword")} />
        {errors.newPassword && (
          <p className="text-destructive text-sm">
            {errors.newPassword.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        loading={isSubmitting}
        className="bg-navy hover:bg-navy/90 text-white"
      >
        Change password
      </Button>
    </form>
  );
}
