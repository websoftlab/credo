
export default {
	regExp: ".+?",
	formatter(args: string[]) {
		if(args.length !== 1) {
			throw new Error("The `date` modifier must have 1 argument");
		}
		const regExp = new RegExp("^" + args[0] + "$");
		return (value: string) => {
			const m = value.match(regExp);
			return m ? (m.length > 1 ? {value: m} : true) : false;
		}
	}
}