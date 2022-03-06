import {unique} from "../utils";

export default {
	regExp: ".+?",
	formatter(args: string[]) {
		args = unique("in", args);
		if(args.length === 1) {
			return (value: string) => {
				return args[0] === value;
			}
		}
		return (value: string) => {
			return args.includes(value);
		}
	},
}