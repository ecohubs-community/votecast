import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { siwe } from 'better-auth/plugins/siwe';
import { verifyMessage } from 'viem';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as authSchema from '$lib/server/db/auth.schema';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5930',
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: authSchema.user,
			session: authSchema.session,
			account: authSchema.account,
			verification: authSchema.verification,
			walletAddress: authSchema.walletAddressTable
		}
	}),
	emailAndPassword: { enabled: true },
	user: {
		additionalFields: {
			walletAddress: {
				type: 'string',
				required: false,
				input: false // not settable during normal signup
			},
			displayName: {
				type: 'string',
				required: false,
				input: true
			},
			avatarUrl: {
				type: 'string',
				required: false,
				input: true
			}
		}
	},
	plugins: [
		siwe({
			domain: env.ORIGIN ? new URL(env.ORIGIN).hostname : 'localhost',
			anonymous: true,
			async getNonce() {
				return crypto.randomUUID();
			},
			async verifyMessage({ message, signature, address }) {
				return verifyMessage({
					message,
					signature: signature as `0x${string}`,
					address: address as `0x${string}`
				});
			}
		}),
		sveltekitCookies(getRequestEvent) // must remain last
	]
});
