import {noArgs} from "../utils";

export default {
	regExp: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}",
	uuid(args: string[]) {
		noArgs("uuid", args);
		return (value: string) => {
			return { value: value.toUpperCase() };
		}
	},
}