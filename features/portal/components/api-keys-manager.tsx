"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Copy, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

export type ApiKeyInfo = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export function ApiKeysManager({ apiKeys }: { apiKeys: ApiKeyInfo[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createKey() {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/portal/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setRevealedKey(data.fullKey);
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    setRevokingId(id);
    await fetch(`/api/portal/api-keys/${id}/revoke`, { method: "POST" });
    router.refresh();
    setRevokingId(null);
  }

  function closeDialog() {
    setOpen(false);
    setRevealedKey(null);
    setCopied(false);
    setError(null);
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}
        >
          <DialogTrigger
            render={
              <Button size="sm" className="bg-navy hover:bg-navy/90 text-white">
                <Plus className="size-4" />
                New API key
              </Button>
            }
          />
          <DialogContent>
            {revealedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Your new API key</DialogTitle>
                  <DialogDescription>
                    Copy it now — for your security, this is the only time
                    it&apos;s shown. It won&apos;t be recoverable afterward.
                  </DialogDescription>
                </DialogHeader>
                <div className="border-border bg-muted flex items-center gap-2 rounded-lg border p-3">
                  <code className="flex-1 overflow-x-auto text-xs">
                    {revealedKey}
                  </code>
                  <Button variant="outline" size="icon-sm" onClick={copyKey}>
                    {copied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    className="bg-navy hover:bg-navy/90 text-white"
                    onClick={closeDialog}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API key</DialogTitle>
                  <DialogDescription>
                    Give it a name so you can identify what it&apos;s used for
                    later.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. CI pipeline"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {error && <p className="text-destructive text-sm">{error}</p>}
                </div>
                <DialogFooter>
                  <Button
                    className="bg-navy hover:bg-navy/90 text-white"
                    loading={creating}
                    disabled={name.trim().length < 2}
                    onClick={createKey}
                  >
                    Create key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create one to authenticate requests to UAMSATech products programmatically."
        />
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="border-border flex items-center justify-between rounded-xl border p-4"
            >
              <div className="flex items-center gap-3">
                <span className="bg-navy/10 text-navy dark:bg-blue-accent/15 dark:text-blue-accent flex h-9 w-9 items-center justify-center rounded-lg">
                  <KeyRound className="size-4" />
                </span>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {key.name}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {key.keyPrefix}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={revokingId === key.id}
                onClick={() => revoke(key.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
