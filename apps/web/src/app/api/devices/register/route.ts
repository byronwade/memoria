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
		const { deviceId, deviceName, hostname, platform } = body;

		if (!deviceId || typeof deviceId !== "string") {
			return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
		}

		const client = new ConvexHttpClient(convexUrl);

		const result = await client.mutation(api.devices.registerDevice, {
			deviceId,
			deviceName: deviceName || undefined,
			hostname: hostname || undefined,
			platform: platform || undefined,
		});

		return NextResponse.json({
			success: true,
			status: result.status,
			deviceDbId: result.deviceDbId,
		});
	} catch (err) {
		console.error("Device registration error:", err);
		return NextResponse.json(
			{ error: (err as Error).message || "Failed to register device" },
			{ status: 500 }
		);
	}
}
