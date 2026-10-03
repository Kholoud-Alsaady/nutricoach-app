// Helpers to load the signed-in user + profile and guard pages by role.

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Gym, Profile, Role } from "./types";

export async function getSession() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) return null;
  const { data: gym } = await db.from("gyms").select("*").eq("id", profile.gym_id).single<Gym>();
  return { db, user, profile, gym: gym! };
}

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "coach" ? "/coach" : "/member";
}

/** Use at the top of a page/layout. Redirects if signed out or wrong role. */
export async function requireRole(roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/");
  if (!roles.includes(s.profile.role)) redirect(homeFor(s.profile.role));
  return s;
}
