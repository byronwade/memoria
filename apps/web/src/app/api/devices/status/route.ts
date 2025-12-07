import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function GET(request: NextRequest) {
	if (!convexUrl) {
		return NextResponse.json({ error: "Server not configured" }, { status: 500 });
	}

	try {
		const { searchParams } = new URL(request.url);
		const deviceId = searchParams.get("deviceId");

		if (!deviceId) {
			return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
		}

		const client = new ConvexHttpClient(convexUrl);

		const result = await client.query(api.devices.getDeviceStatus, {
			deviceId,
		});

		if (!result.found) {
			return NextResponse.json({ error: "Device not found" }, { status: 404 });
		}

		return NextResponse.json({
			status: result.status,
			user: result.user,
			deviceName: result.deviceName,
			lastSeenAt: result.lastSeenAt,
			createdAt: result.createdAt,
		});
	} catch (err) {
		console.error("Device status error:", err);
		return NextResponse.json(
			{ error: (err as Error).message || "Failed to get device status" },
			{ status: 500 }
		);
	}
}
