import { getSession } from "@/lib/auth/session";
import { HeaderAuthClient, HeaderAuthMobile } from "./header-auth-client";

export async function HeaderAuth() {
	const session = await getSession();

	return <HeaderAuthClient user={session?.user ?? null} />;
}

export async function HeaderAuthMobileNav() {
	const session = await getSession();

	return <HeaderAuthMobile user={session?.user ?? null} />;
}
