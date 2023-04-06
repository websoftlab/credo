export class DisplayError extends Error {
	constructor(message: string, public codeName: string | null = null) {
		super(message);
	}
	static isError(error: unknown): error is DisplayError {
		return error ? error instanceof DisplayError : false;
	}
}
