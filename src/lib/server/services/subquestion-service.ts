import { eq, desc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal, ballotQuestion } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { emit } from '../events';
import { requireMember, getMember } from './membership-service';
import { resolveMethodContext, getTypeVersionDefaults } from './proposal-type-service';
import { resolveProposalPhase } from './proposal-phase';
import { insertQuestion } from './multi-question';
import { validateBody } from './proposal-validation';
import type { Database } from './types';

type ProposalRow = typeof proposal.$inferSelect;

/**
 * Decide whether `userId` may add a question to `p` right now, without throwing (design D8). Used both
 * by `addSubquestion` (which converts a failure into an error) and the detail page (to show/hide the
 * "Add a question" control).
 */
async function evaluateContribution(
	p: ProposalRow,
	userId: string,
	db: Database
): Promise<{ ok: true } | { ok: false; code: 'invalid' | 'forbidden'; reason: string }> {
	const { snapshot } = await resolveMethodContext(p, db);
	if (snapshot.ballotModuleId !== 'multi-question') {
		return { ok: false, code: 'invalid', reason: 'Only Common Ground proposals collect questions' };
	}

	// The proposal froze its own policy at creation; fall back to the type version for older rows.
	const defaults = p.typeVersionId ? await getTypeVersionDefaults(p.typeVersionId, db) : null;
	const contributors = p.questionContributors ?? defaults?.questionContributors ?? 'proposer';
	const contributionPhase =
		p.questionContributionPhase ?? defaults?.questionContributionPhase ?? 'creation';

	// Freeze at voting-open: only draft/deliberation can still gain questions.
	const phase = await resolveProposalPhase(p, Date.now(), db);
	if (phase !== 'draft' && phase !== 'deliberation') {
		return { ok: false, code: 'invalid', reason: 'Questions are frozen once voting opens' };
	}
	if (contributionPhase === 'creation') {
		return {
			ok: false,
			code: 'invalid',
			reason: 'Questions are fixed once the proposal is created.'
		};
	}
	if (phase !== 'deliberation') {
		return {
			ok: false,
			code: 'invalid',
			reason: 'Questions can only be added during the deliberation phase'
		};
	}
	if (contributors === 'proposer' && p.createdBy !== userId) {
		return { ok: false, code: 'forbidden', reason: 'Only the proposer can add questions' };
	}
	return { ok: true };
}

/**
 * Add a sub-question to a Common Ground (multi-question) proposal during its contribution window
 * (design D8). Emits `subquestion.added`.
 */
export async function addSubquestion(
	userId: string,
	proposalId: string,
	prompt: string,
	db: Database = defaultDb
): Promise<{ questionId: string }> {
	const [p] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!p) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');

	await requireMember(p.communityId, userId, db);

	const text = prompt?.trim();
	validateBody(text); // reuse the non-empty/length guard

	const check = await evaluateContribution(p, userId, db);
	if (!check.ok) {
		throw new ServiceError(
			check.code === 'forbidden' ? ErrorCode.FORBIDDEN : ErrorCode.INVALID_REQUEST,
			check.reason
		);
	}

	const [last] = await db
		.select({ position: ballotQuestion.position })
		.from(ballotQuestion)
		.where(eq(ballotQuestion.proposalId, proposalId))
		.orderBy(desc(ballotQuestion.position))
		.limit(1);
	const nextPosition = (last?.position ?? -1) + 1;

	const questionId = db.transaction((tx) => insertQuestion(tx, proposalId, text, nextPosition));

	emit('subquestion.added', {
		proposalId,
		communityId: p.communityId,
		questionId,
		addedBy: userId
	});

	return { questionId };
}

/** Whether `userId` can add a question to `proposalId` right now (non-throwing; for the UI). */
export async function canAddSubquestion(
	userId: string | undefined,
	proposalId: string,
	db: Database = defaultDb
): Promise<boolean> {
	if (!userId) return false;
	const [p] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!p) return false;
	const membership = await getMember(p.communityId, userId, db);
	if (!membership) return false;
	return (await evaluateContribution(p, userId, db)).ok;
}

/**
 * For the detail page: whether the viewer can add a question, and — when they can't — a friendly note
 * explaining why (so a multi-question proposal never silently lacks the control). Returns a null note
 * for non-members / non-multi-question proposals (nothing to explain).
 */
export async function contributionStatus(
	userId: string | undefined,
	proposalId: string,
	db: Database = defaultDb
): Promise<{ canAdd: boolean; note: string | null }> {
	if (!userId) return { canAdd: false, note: null };
	const [p] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!p) return { canAdd: false, note: null };

	const { snapshot } = await resolveMethodContext(p, db);
	if (snapshot.ballotModuleId !== 'multi-question') return { canAdd: false, note: null };

	const membership = await getMember(p.communityId, userId, db);
	if (!membership) return { canAdd: false, note: null };

	const check = await evaluateContribution(p, userId, db);
	return { canAdd: check.ok, note: check.ok ? null : check.reason };
}
