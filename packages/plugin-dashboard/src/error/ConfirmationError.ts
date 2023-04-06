export class ConfirmationError extends Error {
	constructor(
		message: string,
		public data: Record<string, string | number | boolean>,
		public codeName: string | null = null
	) {
		super(message);
	}
	static isError(error: unknown): error is ConfirmationError {
		return error ? error instanceof ConfirmationError : false;
	}
}
