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

		// First get the device to find its DB ID
		const deviceStatus = await client.query(api.devices.getDeviceStatus, {
			deviceId,
		});

		if (!deviceStatus.found) {
			return NextResponse.json({ error: "Device not found" }, { status: 404 });
		}

		// We need the device DB ID - the validateDevice query returns it
		const validation = await client.query(api.devices.validateDevice, {
			deviceId,
		});

		if (validation.valid && validation.deviceDbId) {
			await client.mutation(api.devices.unlinkDevice, {
				deviceDbId: validation.deviceDbId,
			});
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("Device unlink error:", err);
		return NextResponse.json(
			{ error: (err as Error).message || "Failed to unlink device" },
			{ status: 500 }
		);
	}
}
