import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function POST(request: NextRequest) {
	if (!convexUrl) {
		return NextResponse.json({ error: "Server not configured" }, { status: 500 });
	}

	try {
		const body = await request.json();
		const { deviceId } = body;

		if (!deviceId || typeof deviceId !== "string") {
			return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
		}

		const client = new ConvexHttpClient(convexUrl);

		const result = await client.query(api.devices.validateDevice, {
			deviceId,
		});

		if (!result.valid) {
			return NextResponse.json(
				{
					valid: false,
					error: result.error,
					status: result.status,
				},
				{ status: result.status === "pending" ? 200 : 401 }
			);
		}

		// Update last seen
		await client.mutation(api.devices.updateDeviceLastSeen, {
			deviceId,
		});

		return NextResponse.json({
			valid: true,
			userId: result.userId,
			userName: result.userName,
			userEmail: result.userEmail,
		});
	} catch (err) {
		console.error("Device validation error:", err);
		return NextResponse.json(
			{ valid: false, error: (err as Error).message || "Failed to validate device" },
			{ status: 500 }
		);
	}
}
