import { uniqueNum } from "../utils";

export default {
	regExp: "0|[1-9]\\d*",
	formatter(args: string[]) {
		const ids = uniqueNum("dIn", args);
		if (ids.length === 1) {
			return (val: string) => {
				const value = parseInt(val);
				return ids[0] === value ? { value } : false;
			};
		}
		return (val: string) => {
			const value = parseInt(val);
			return ids.includes(value) ? { value } : false;
		};
	},
};
