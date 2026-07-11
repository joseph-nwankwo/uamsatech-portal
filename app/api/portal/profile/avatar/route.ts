import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logActivity } from "@/lib/portal/audit";
import { isStorageConfigured, uploadFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Every accepted upload is a real write to object storage — a real cost,
  // not just a DB row. Limit before doing any storage work.
  const { allowed } = await checkRateLimit(
    `avatar-upload:${session.sub}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429 }
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "File uploads aren't configured yet." },
      { status: 503 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("avatar");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, or WebP images are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 2MB or smaller." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = EXTENSION_BY_TYPE[file.type];
  const key = `avatars/${session.sub}-${Date.now()}.${extension}`;

  const url = await uploadFile(key, buffer, file.type);

  await db.user.update({
    where: { id: session.sub },
    data: { avatarUrl: url },
  });

  await logActivity(session.sub, "user.profile_updated", {
    avatarUpdated: true,
  });

  return NextResponse.json({ avatarUrl: url });
}
