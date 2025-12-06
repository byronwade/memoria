import jwt from "jsonwebtoken";
import { Octokit } from "@octokit/rest";

// Environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Types
export interface GitHubTokenResponse {
	access_token: string;
	token_type: string;
	scope: string;
	refresh_token?: string;
	expires_in?: number;
	error?: string;
	error_description?: string;
}

export interface GitHubUser {
	id: number;
	login: string;
	email: string | null;
	name: string | null;
	avatar_url: string;
}

export interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function generateGitHubOAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: GITHUB_CLIENT_ID,
		redirect_uri: `${APP_URL}/api/auth/github/callback`,
		scope: "user:email read:org repo",
		state,
	});
	return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			client_id: GITHUB_CLIENT_ID,
			client_secret: GITHUB_CLIENT_SECRET,
			code,
		}),
	});

	if (!response.ok) {
		throw new Error(`GitHub token exchange failed: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get GitHub user profile from access token
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get GitHub user's primary email (for users with private email)
 */
export async function getGitHubUserEmail(accessToken: string): Promise<string | null> {
	const response = await fetch("https://api.github.com/user/emails", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		return null;
	}

	const emails: GitHubEmail[] = await response.json();
	const primary = emails.find((e) => e.primary && e.verified);
	return primary?.email || emails[0]?.email || null;
}

/**
 * Generate JWT for GitHub App authentication
 * Used for app-level API calls (before getting installation token)
 */
export function generateAppJWT(): string {
	if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
		throw new Error("GitHub App credentials not configured");
	}

	const now = Math.floor(Date.now() / 1000);
	const privateKey = GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");

	return jwt.sign(
		{
			iat: now - 60, // Issued 60 seconds ago (clock drift)
			exp: now + 600, // Expires in 10 minutes
			iss: GITHUB_APP_ID,
		},
		privateKey,
		{ algorithm: "RS256" }
	);
}

/**
 * Get an Octokit instance authenticated as the GitHub App
 */
export function getAppOctokit(): Octokit {
	const jwtToken = generateAppJWT();
	return new Octokit({ auth: jwtToken });
}

/**
 * Get installation access token for making API calls on behalf of an installation
 */
export async function getInstallationToken(installationId: number): Promise<string> {
	const appOctokit = getAppOctokit();

	const { data } = await appOctokit.apps.createInstallationAccessToken({
		installation_id: installationId,
	});

	return data.token;
}

/**
 * Get an Octokit instance authenticated for a specific installation
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
	const token = await getInstallationToken(installationId);
	return new Octokit({ auth: token });
}

/**
 * Get GitHub App installation details
 */
export async function getInstallation(installationId: number) {
	const appOctokit = getAppOctokit();
	const { data } = await appOctokit.apps.getInstallation({
		installation_id: installationId,
	});
	return data;
}

/**
 * List all repositories accessible to an installation (handles pagination)
 */
export async function listInstallationRepos(installationId: number) {
	const octokit = await getInstallationOctokit(installationId);

	// Use pagination to get all repos
	const repos: Awaited<ReturnType<typeof octokit.apps.listReposAccessibleToInstallation>>["data"]["repositories"] = [];
	let page = 1;
	const perPage = 100;

	while (true) {
		const { data } = await octokit.apps.listReposAccessibleToInstallation({
			per_page: perPage,
			page,
		});

		repos.push(...data.repositories);
		console.log(`[listInstallationRepos] Fetched page ${page}: ${data.repositories.length} repos (total: ${repos.length}/${data.total_count})`);

		// If we got fewer than perPage, we've reached the last page
		if (data.repositories.length < perPage) {
			break;
		}
		page++;
	}

	return repos;
}

/**
 * Generate GitHub App installation URL
 */
export function generateInstallUrl(state?: string): string {
	const appName = process.env.GITHUB_APP_NAME || "memoria-app";
	let url = `https://github.com/apps/${appName}/installations/new`;
	if (state) {
		url += `?state=${encodeURIComponent(state)}`;
	}
	return url;
}
