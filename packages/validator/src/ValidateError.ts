export default class ValidateError extends Error {
	constructor(
		message: string,
		public field: string,
		public errorCode: string = "invalidValue",
		public errorDetail: any = {}
	) {
		super(message);
	}
	static isValidateError(error: any): error is ValidateError {
		return error ? error instanceof ValidateError : false;
	}
}
