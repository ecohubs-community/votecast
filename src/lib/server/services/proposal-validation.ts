import { ServiceError, ErrorCode } from './errors';

// Input validation for proposals. Pure assertion helpers — no DB, no side effects.

export function validateTitle(title: unknown): asserts title is string {
	if (typeof title !== 'string' || title.trim().length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Title is required');
	}
	if (title.trim().length > 200) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Title must be at most 200 characters');
	}
}

export function validateBody(body: unknown): asserts body is string {
	if (typeof body !== 'string' || body.trim().length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Body is required');
	}
	if (body.length > 10000) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Body must be at most 10000 characters');
	}
}

export function validateChoices(choices: unknown): asserts choices is string[] {
	if (!Array.isArray(choices)) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'Choices must be an array');
	}
	if (choices.length < 2) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'At least 2 choices are required');
	}
	if (choices.length > 20) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'At most 20 choices are allowed');
	}
	for (const choice of choices) {
		if (typeof choice !== 'string' || choice.trim().length === 0) {
			throw new ServiceError(ErrorCode.INVALID_CHOICES, 'Each choice must be a non-empty string');
		}
		if (choice.trim().length > 200) {
			throw new ServiceError(ErrorCode.INVALID_CHOICES, 'Each choice must be at most 200 characters');
		}
	}
}

export function toDate(value: Date | string): Date {
	const d = typeof value === 'string' ? new Date(value) : value;
	if (isNaN(d.getTime())) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Invalid date');
	}
	return d;
}

export function validateVisibility(v: unknown): asserts v is 'public' | 'community' {
	if (v !== 'public' && v !== 'community') {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Visibility must be "public" or "community"');
	}
}
