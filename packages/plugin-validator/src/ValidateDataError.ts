export default class ValidateDataError extends Error {
	constructor(message: string, public errors: Record<string, string | string[]>) {
		super(message);
	}
	static isValidateDataError(error: any): error is ValidateDataError {
		return error ? error instanceof ValidateDataError : false;
	}
}
