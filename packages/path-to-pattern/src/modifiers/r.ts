import {isNum} from "../utils";

export default {
	regExp: "0|[1-9]\\d*",
	formatter(args: string[]) {
		if(args.length !== 2 || !isNum(args[0]) || !isNum(args[1])) {
			throw new Error("The `r` modifier must have 2 numeric arguments");
		}
		const from = parseInt(args[0]);
		const to = parseInt(args[1]);
		if(from > to) {
			throw new Error("For the `r` modifier, the value of the first argument must be less than or equal to the second");
		}
		return (val: string) => {
			const value = parseInt(val);
			return from <= value && to >= value ? { value } : false;
		}
	}
}