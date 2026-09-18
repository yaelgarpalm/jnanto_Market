}

function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function traceUrl(traceCode: string): string {
  return `${APP_URL.replace(/\/$/, "")}/trazabilidad/${encodeURIComponent(traceCode)}`;
}

function traceUrlFromRequest(req: Request, traceCode: string): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  if (!host) return traceUrl(traceCode);
  return `${protocol}://${host}/trazabilidad/${encodeURIComponent(traceCode)}`;
}

async function getUserFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function profileFromUserMetadata(user: User): Profile {
  const metadata = user.user_metadata || {};
  // Never trust auth user_metadata to assign an application role.
  // Privileged roles must already exist in the profiles table and be provisioned by an administrator.
  const role: ProfileRole = "customer";
  const fullName =
    assertString(metadata.full_name) ||
    assertString(metadata.fullName) ||
    assertString(user.email?.split("@")[0], "Cliente Jnatjo");

  return {
    id: user.id,
    full_name: fullName,
    email: user.email || "",
    role,
    community: assertString(metadata.community, "San Felipe del Progreso"),
    cooperative_id: role === "customer" ? null : assertString(metadata.cooperative_id, "coop-1"),
  };
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;