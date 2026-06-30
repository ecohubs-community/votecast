import { eq, and, asc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { ballotQuestion, proposalChoice, voteSelection } from '$lib/server/db/schema';
import { mqOptionId, type MultiQuestionPosition } from '$lib/server/voting';
import type { Database } from './types';

// Common Ground (multi-question) persistence + tally bridging. Each question stores three default
// positions as `proposal_choice` rows whose `position` index maps onto the engine's agree/disagree/
// pass encoding, so the existing (tested) multi-question module/rule run unchanged.

/** Position by `proposal_choice.position` index — index 0 = agree, 1 = disagree, 2 = pass. */
export const MQ_POSITIONS: readonly MultiQuestionPosition[] = ['agree', 'disagree', 'pass'];
export const MQ_POSITION_LABELS = ['Agree', 'Disagree', 'Abstain'];

// better-sqlite3 transaction handle has the same insert API as the db; typed loosely for reuse.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/** Insert one question + its three default position-choices inside an open transaction. */
export function insertQuestion(
	tx: Tx,
	proposalId: string,
	prompt: string,
	position: number
): string {
	const q = tx
		.insert(ballotQuestion)
		.values({ proposalId, prompt: prompt.trim(), position })
		.returning()
		.get();
	for (let i = 0; i < MQ_POSITION_LABELS.length; i++) {
		tx.insert(proposalChoice)
			.values({ proposalId, questionId: q.id, label: MQ_POSITION_LABELS[i], position: i })
			.run();
	}
	return q.id;
}

/** A question with its position-choices, for the create/detail/voting UIs. */
export interface QuestionView {
	id: string;
	prompt: string;
	position: number;
	choices: Array<{ id: string; label: string; position: number }>;
}

/** Load a proposal's questions (each with its position-choices), ordered. */
export async function loadQuestions(
	proposalId: string,
	db: Database = defaultDb
): Promise<QuestionView[]> {
	const questions = await db
		.select()
		.from(ballotQuestion)
		.where(eq(ballotQuestion.proposalId, proposalId))
		.orderBy(asc(ballotQuestion.position));
	if (questions.length === 0) return [];

	const choices = await db
		.select()
		.from(proposalChoice)
		.where(eq(proposalChoice.proposalId, proposalId))
		.orderBy(asc(proposalChoice.position));

	return questions.map((q) => ({
		id: q.id,
		prompt: q.prompt,
		position: q.position,
		choices: choices
			.filter((c) => c.questionId === q.id)
			.map((c) => ({ id: c.id, label: c.label, position: c.position }))
	}));
}

/** A user's existing per-question answers as a questionId → choiceId map (for re-display). */
export async function getUserMultiQuestionAnswers(
	userId: string,
	proposalId: string,
	db: Database = defaultDb
): Promise<Record<string, string>> {
	const rows = await db
		.select({ questionId: voteSelection.questionId, choiceId: voteSelection.choiceId })
		.from(voteSelection)
		.where(and(eq(voteSelection.proposalId, proposalId), eq(voteSelection.userId, userId)));
	const map: Record<string, string> = {};
	for (const r of rows) if (r.questionId && r.choiceId) map[r.questionId] = r.choiceId;
	return map;
}

/**
 * Map a proposal's questions/choices/selections onto the multi-question engine encoding:
 * options keyed by `mqOptionId(questionId, position)` (grouped + labelled by question), and each
 * voter's selections as `{ questionId, position }`.
 */
export function buildMqTallyInputs(
	questions: QuestionView[],
	selections: Array<{ userId: string; choiceId: string | null; questionId: string | null }>
) {
	const positionByChoice = new Map<
		string,
		{ questionId: string; position: MultiQuestionPosition }
	>();
	const options: Array<{ optionId: string; group: string; label: string }> = [];
	for (const q of questions) {
		for (const c of q.choices) {
			const pos = MQ_POSITIONS[c.position];
			if (!pos) continue;
			positionByChoice.set(c.id, { questionId: q.id, position: pos });
			options.push({ optionId: mqOptionId(q.id, pos), group: q.id, label: q.prompt });
		}
	}

	const selectionsByUser = new Map<
		string,
		Array<{ questionId: string; position: MultiQuestionPosition }>
	>();
	for (const s of selections) {
		if (!s.choiceId) continue;
		const mapped = positionByChoice.get(s.choiceId);
		if (!mapped) continue;
		const list = selectionsByUser.get(s.userId) ?? [];
		list.push({ questionId: mapped.questionId, position: mapped.position });
		selectionsByUser.set(s.userId, list);
	}

	return { options, selectionsByUser };
}
