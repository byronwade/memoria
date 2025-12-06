import { getSession } from "@/lib/auth/session";
import { HeaderAuthClient } from "./header-auth-client";

export async function HeaderAuth() {
	const session = await getSession();

	return <HeaderAuthClient user={session?.user ?? null} />;
}
