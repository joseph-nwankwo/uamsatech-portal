"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
});

type ProfileValues = z.infer<typeof profileSchema>;

function AvatarUploader({
  initialName,
  email,
  avatarUrl,
  storageConfigured,
}: {
  initialName: string;
  email: string;
  avatarUrl: string | null;
  storageConfigured: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials =
    (initialName || email).trim().slice(0, 2).toUpperCase() || "?";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    const body = new FormData();
    body.append("avatar", file);

    const res = await fetch("/api/portal/profile/avatar", {
      method: "POST",
      body,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't upload that image.");
      return;
    }

    setPreview(data.avatarUrl);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar host is arbitrary (S3-compatible, user-configured), not a known Next Image domain
        <img
          src={preview}
          alt=""
          className="border-border h-16 w-16 rounded-full border object-cover"
        />
      ) : (
        <div className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold">
          {initials}
        </div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          disabled={!storageConfigured}
          onClick={() => fileInputRef.current?.click()}
        >
          Change photo
        </Button>
        <p className="text-muted-foreground mt-1.5 text-xs">
          {storageConfigured
            ? "PNG, JPEG, or WebP. 2MB max."
            : "File uploads aren't configured yet."}
        </p>
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      </div>
    </div>
  );
}

export function ProfileForm({
  initialName,
  email,
  avatarUrl,
  storageConfigured,
}: {
  initialName: string;
  email: string;
  avatarUrl: string | null;
  storageConfigured: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialName },
  });

  async function onSubmit(values: ProfileValues) {
    setFormError(null);
    setSuccess(false);
    const response = await fetch("/api/portal/profile", {
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
    <div className="max-w-sm space-y-6">
      <AvatarUploader
        initialName={initialName}
        email={email}
        avatarUrl={avatarUrl}
        storageConfigured={storageConfigured}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {formError && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {formError}
          </p>
        )}
        {success && (
          <p className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm">
            Profile updated.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-name">Full name</Label>
          <Input id="profile-name" {...register("name")} />
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
    </div>
  );
}
