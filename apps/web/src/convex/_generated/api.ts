// Placeholder Convex API definitions.
// Replace with generated files from `npx convex dev` when a Convex project is connected.

// eslint-disable-next-line @typescript-eslint/ban-types
type AnyFunctionReference = any;

export const api = {
	tasks: {
		get: "tasks:get" as AnyFunctionReference,
	},
	devices: {
		registerDevice: "devices:registerDevice" as AnyFunctionReference,
		linkDevice: "devices:linkDevice" as AnyFunctionReference,
		getDeviceStatus: "devices:getDeviceStatus" as AnyFunctionReference,
		validateDevice: "devices:validateDevice" as AnyFunctionReference,
		unlinkDevice: "devices:unlinkDevice" as AnyFunctionReference,
		listDevices: "devices:listDevices" as AnyFunctionReference,
		updateDeviceLastSeen: "devices:updateDeviceLastSeen" as AnyFunctionReference,
	},
	memories: {
		create: "memories:create" as AnyFunctionReference,
		getByFilePath: "memories:getByFilePath" as AnyFunctionReference,
		searchByKeywords: "memories:searchByKeywords" as AnyFunctionReference,
	},
	guardrails: {
		getByFilePath: "guardrails:getByFilePath" as AnyFunctionReference,
	},
	teamTokens: {
		validate: "teamTokens:validate" as AnyFunctionReference,
	},
	sessions: {
		getByToken: "sessions:getByToken" as AnyFunctionReference,
		create: "sessions:create" as AnyFunctionReference,
	},
	users: {
		getById: "users:getById" as AnyFunctionReference,
		getByEmail: "users:getByEmail" as AnyFunctionReference,
		create: "users:create" as AnyFunctionReference,
	},
};





