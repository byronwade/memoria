import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getConvexClient, callMutation } from "@/lib/convex";

export async function POST() {
	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		if (sessionToken) {
			// Revoke the session in Convex
			const convex = getConvexClient();
			await callMutation(convex, "auth:revokeSession", { sessionToken });
		}

		// Clear the session cookie
		const response = NextResponse.json({ success: true });
		response.cookies.set("session_token", "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 0, // Expire immediately
		});

		return response;
	} catch (error) {
		console.error("Logout error:", error);
		// Still clear the cookie even if Convex call fails
		const response = NextResponse.json({ success: true });
		response.cookies.set("session_token", "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});
		return response;
	}
}

export async function GET() {
	// Support GET for simple link-based logout
	const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		if (sessionToken) {
			const convex = getConvexClient();
			await callMutation(convex, "auth:revokeSession", { sessionToken });
		}
	} catch (error) {
		console.error("Logout error:", error);
	}

	response.cookies.set("session_token", "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});

	return response;
}
