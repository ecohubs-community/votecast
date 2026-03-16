import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { eq, and } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { walletAddressTable } from '$lib/server/db/schema';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { initPlugins } from '$lib/server/plugins';

// Initialize plugins once at server startup (not during build)
if (!building) {
	initPlugins();
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		// Enrich user with primary wallet address from wallet_address table.
		// The SIWE plugin stores wallets in a separate table, not on the user row.
		if (!event.locals.user.walletAddress) {
			const [primaryWallet] = await db
				.select({ address: walletAddressTable.address })
				.from(walletAddressTable)
				.where(
					and(
						eq(walletAddressTable.userId, session.user.id),
						eq(walletAddressTable.isPrimary, true)
					)
				)
				.limit(1);

			if (primaryWallet) {
				event.locals.user = {
					...event.locals.user,
					walletAddress: primaryWallet.address
				};
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
