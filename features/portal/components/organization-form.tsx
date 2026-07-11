"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name is too short"),
});

type OrgValues = z.infer<typeof orgSchema>;

export function OrganizationForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: initialName },
  });

  async function onSubmit(values: OrgValues) {
    setFormError(null);
    setSuccess(false);
    const response = await fetch("/api/portal/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();

    if (!response.ok) {
      setFormError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setSuccess(true);
    router.refresh();
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
          Organization updated.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" {...register("name")} />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
      </div>
      <Button
        type="submit"
        loading={isSubmitting}
        className="bg-navy hover:bg-navy/90 text-white"
      >
        Save changes
      </Button>
    </form>
  );
}
