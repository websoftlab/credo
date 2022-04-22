import { noArgs } from "../utils";

export default {
	regExp: "0|[1-9]\\d*",
	formatter(args: string[]) {
		noArgs("d", args);
		return (value: string) => {
			return { value: parseInt(value) };
		};
	},
};
