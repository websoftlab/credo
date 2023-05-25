import type { Context } from "koa";
import type { ValidateService } from "@phragon/plugin-validator";
import { ConfirmationError, DisplayError } from "../error";
import createHttpError from "http-errors";
import { ctxLoadLanguagePackage } from "./ctxLoadLanguagePackage";

export interface CtxGetError {
	code: number;
	codeName: string | null;
	message: string;
	error: Error;
	detected: boolean;
	payload?: any;
}

function isName(name: string | null): name is string {
	return name != null && !name.includes(":");
}

export async function ctxGetError(ctx: Context, error: Error): Promise<CtxGetError> {
	const prefix = ctx.dashboardPlugin ? ctx.dashboardPlugin.name : null;
	const packages = ["validate"];
	if (isName(prefix)) {
		packages.push(prefix);
	}

	await ctxLoadLanguagePackage(ctx, packages);

	function codeNameMessage(message: string, codeName: string | null, slug: string = "error") {
		if (codeName != null) {
			if (isName(prefix)) {
				const text = ctx.store.line(`${prefix}:${codeName}`);
				if (text != null) {
					return text;
				}
			}
			const text = ctx.store.line(`validate:${codeName}`);
			if (text != null) {
				return text;
			}
		}
		codeName = `${slug}.${message}`;
		if (isName(prefix)) {
			const text = ctx.store.line(`${prefix}:${codeName}`);
			if (text != null) {
				return text;
			}
		}
		return ctx.store.translate(`validate:${codeName}`, message);
	}

	function done(detail: Partial<CtxGetError>): CtxGetError {
		const { code = 500, codeName = null, detected = true, message, payload } = detail;
		const info: CtxGetError = {
			error,
			code,
			codeName,
			detected,
			message: message || error.message || "Unknown error",
		};
		if (payload) {
			info.payload = payload;
		}
		return info;
	}

	if (DisplayError.isError(error)) {
		const { message, codeName } = error;
		return done({
			codeName: "displayError",
			message: codeNameMessage(message, codeName, "display"),
		});
	}

	if (ConfirmationError.isError(error)) {
		const { codeName, data } = error;
		const message = codeNameMessage(error.message || "Confirmation required", codeName, "confirmation");
		return done({
			code: 400,
			codeName: "confirmationError",
			message,
			payload: {
				message,
				data,
			},
		});
	}

	const validator: ValidateService | undefined = ctx.phragon.services.validator;
	if (validator) {
		if (validator.isValidateDataError(error)) {
			return done({
				code: 400,
				codeName: "validateError",
				message: error.message || codeNameMessage("Data error", "dataError"),
				payload: {
					errors: error.errors,
				},
			});
		}
		if (validator.isValidateError(error)) {
			return done({
				code: 400,
				codeName: "validateError",
				message: codeNameMessage("Data error", "dataError"),
				payload: {
					errors: {
						[error.field]: error.message,
					},
				},
			});
		}
	}

	const code = createHttpError.isHttpError(error) ? error.statusCode : 500;
	if (createHttpError.isHttpError(error)) {
		const text = (error as Error).message;
		if (text) {
			return done({
				code,
				message: codeNameMessage(text, `httpError${code}`, "http"),
			});
		}
	}

	return done({
		code: 500,
		detected: false,
		message: codeNameMessage("Query error", "queryError"),
	});
}
