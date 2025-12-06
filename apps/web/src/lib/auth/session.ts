import { cookies } from "next/headers";
import { getConvexClient, callQuery } from "@/lib/convex";

export interface SessionUser {
	_id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
}

export interface Session {
	user: SessionUser;
}

interface ConvexSessionResult {
	session: {
		_id: string;
		userId: string;
		sessionToken: string;
		expiresAt: number;
		revokedAt: number | null;
	};
	user: {
		_id: string;
		email: string;
		name: string | null;
		avatarUrl: string | null;
	};
}

/**
 * Get the current session from cookies (server-side only)
 * Returns null if not logged in or session is invalid
 */
export async function getSession(): Promise<Session | null> {
	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		if (!sessionToken) {
			return null;
		}

		const convex = getConvexClient();
		const result = await callQuery<ConvexSessionResult | null>(
			convex,
			"auth:getSession",
			{ sessionToken }
		);

		if (!result || !result.user) {
			return null;
		}

		return {
			user: {
				_id: result.user._id,
				email: result.user.email,
				name: result.user.name,
				avatarUrl: result.user.avatarUrl,
			},
		};
	} catch (error) {
		console.error("Failed to get session:", error);
		return null;
	}
}
