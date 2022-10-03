import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeCurrencyDetail extends ValidateTypeStringDetail {
	/**
	 * @default '$'
	 */
	symbol?: string | undefined;
	/**
	 * @default false
	 */
	requireSymbol?: boolean | undefined;
	/**
	 * @default false
	 */
	allowSpaceAfterSymbol?: boolean | undefined;
	/**
	 * @default false
	 */
	symbolAfterDigits?: boolean | undefined;
	/**
	 * @default true
	 */
	allowNegatives?: boolean | undefined;
	/**
	 * @default false
	 */
	parensForNegatives?: boolean | undefined;
	/**
	 * @default false
	 */
	negativeSignBeforeDigits?: boolean | undefined;
	/**
	 * @default false
	 */
	negativeSignAfterDigits?: boolean | undefined;
	/**
	 * @default false
	 */
	allowNegativeSignPlaceholder?: boolean | undefined;
	/**
	 * @default ','
	 */
	thousandsSeparator?: string | undefined;
	/**
	 * @default '.'
	 */
	decimalSeparator?: string | undefined;
	/**
	 * @default true
	 */
	allowDecimal?: boolean | undefined;
	/**
	 * @default false
	 */
	requireDecimal?: boolean | undefined;
	/**
	 * The array `digits_after_decimal` is filled with the exact number of digits allowed not a range, for example a range `1` to `3` will be given as `[1, 2, 3]`.
	 *
	 * @default [2]
	 */
	digitsAfterDecimal?: number[] | undefined;
	/**
	 * @default false
	 */
	allowSpaceAfterDigits?: boolean | undefined;
}

export class TypeOfCurrency extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeCurrencyDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isCurrency(value, {
			symbol: options.symbol,
			require_symbol: options.requireSymbol,
			allow_space_after_symbol: options.allowSpaceAfterSymbol,
			symbol_after_digits: options.symbolAfterDigits,
			allow_negatives: options.allowNegatives,
			parens_for_negatives: options.parensForNegatives,
			negative_sign_before_digits: options.negativeSignBeforeDigits,
			negative_sign_after_digits: options.negativeSignAfterDigits,
			allow_negative_sign_placeholder: options.allowNegativeSignPlaceholder,
			thousands_separator: options.thousandsSeparator,
			decimal_separator: options.decimalSeparator,
			allow_decimal: options.allowDecimal,
			require_decimal: options.requireDecimal,
			digits_after_decimal: options.digitsAfterDecimal,
			allow_space_after_digits: options.allowSpaceAfterDigits,
		});
	}
}
