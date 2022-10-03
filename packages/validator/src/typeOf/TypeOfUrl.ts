import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeUrlDetail extends ValidateTypeStringDetail {
	/**
	 * @default ['http','https','ftp']
	 */
	protocols?: string[] | undefined;
	/**
	 * @default true
	 */
	requireTld?: boolean | undefined;
	/**
	 * @default false
	 */
	requireProtocol?: boolean | undefined;
	/**
	 * @default true
	 */
	requireHost?: boolean | undefined;
	/**
	 * if set as true isURL will check if port is present in the URL
	 * @default false
	 */
	requirePort?: boolean | undefined;
	/**
	 * @default true
	 */
	requireValidProtocol?: boolean | undefined;
	/**
	 * @default false
	 */
	allowUnderscores?: boolean | undefined;
	/**
	 * @default false
	 */
	hostWhitelist?: Array<string | RegExp> | undefined;
	/**
	 * @default false
	 */
	hostBlacklist?: Array<string | RegExp> | undefined;
	/**
	 * @default false
	 */
	allowTrailingDot?: boolean | undefined;
	/**
	 * @default false
	 */
	allowProtocolRelativeUrls?: boolean | undefined;
	/**
	 * @default false
	 */
	disallowAuth?: boolean | undefined;
	/**
	 * @default true
	 */
	allowFragments?: boolean | undefined;
	/**
	 * @default true
	 */
	allowQueryComponents?: boolean | undefined;
}

export class TypeOfUrl extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeUrlDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isURL(value, {
			protocols: options.protocols,
			require_tld: options.requireTld,
			require_protocol: options.requireProtocol,
			require_host: options.requireHost,
			require_port: options.requirePort,
			require_valid_protocol: options.requireValidProtocol,
			allow_underscores: options.allowUnderscores,
			host_whitelist: options.hostWhitelist,
			host_blacklist: options.hostBlacklist,
			allow_trailing_dot: options.allowTrailingDot,
			allow_protocol_relative_urls: options.allowProtocolRelativeUrls,
			disallow_auth: options.disallowAuth,
			allow_fragments: options.allowFragments,
			allow_query_components: options.allowQueryComponents,
		});
	}
}
