import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeEmailDetail extends ValidateTypeStringDetail {
	/**
	 * If `allow_display_name` is set to `true`, the validator will also match `Display Name <email-address>`.
	 *
	 * @default false
	 */
	allowDisplayName?: boolean | undefined;
	/**
	 * If `require_display_name` is set to `true`, the validator will reject strings without the format `Display Name <email-address>`.
	 *
	 * @default false
	 */
	requireDisplayName?: boolean | undefined;
	/**
	 * If `allow_utf8_local_part` is set to `false`, the validator will not allow any non-English UTF8 character in email address' local part.
	 *
	 * @default true
	 */
	allowUtf8LocalPart?: boolean | undefined;
	/**
	 * If `require_tld` is set to `false`, e-mail addresses without having TLD in their domain will also be matched.
	 *
	 * @default true
	 */
	requireTld?: boolean | undefined;
	/**
	 * If `ignore_max_length` is set to `true`, the validator will not check for the standard max length of an email.
	 *
	 * @default false
	 */
	ignoreMaxLength?: boolean | undefined;
	/**
	 * If `allow_ip_domain` is set to `true`, the validator will allow IP addresses in the host part.
	 *
	 * @default false
	 */
	allowIpDomain?: boolean | undefined;
	/**
	 * If `domain_specific_validation` is `true`, some additional validation will be enabled,
	 * e.g. disallowing certain syntactically valid email addresses that are rejected by GMail.
	 *
	 * @default false
	 */
	domainSpecificValidation?: boolean | undefined;
	/**
	 *  If host_blacklist is set to an array of strings
	 *  and the part of the email after the @ symbol matches one of the strings defined in it,
	 *  the validation fails.
	 */
	hostBlacklist?: string[] | undefined;
	/**
	 *  If blacklisted_chars receives a string, then the validator will reject emails that include
	 *  any of the characters in the string, in the name part.
	 */
	blacklistedChars?: string | undefined;
}

export class TypeOfEmail extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeEmailDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isEmail(value, {
			host_blacklist: options.hostBlacklist,
			blacklisted_chars: options.blacklistedChars,
			allow_display_name: options.allowDisplayName,
			allow_ip_domain: options.allowIpDomain,
			allow_utf8_local_part: options.allowUtf8LocalPart,
			domain_specific_validation: options.domainSpecificValidation,
			ignore_max_length: options.ignoreMaxLength,
			require_display_name: options.requireDisplayName,
			require_tld: options.requireTld,
		});
	}
}
