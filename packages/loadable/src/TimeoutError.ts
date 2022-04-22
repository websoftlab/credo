export default class TimeoutError extends Error {
	constructor() {
		super("Loading time expired");
	}
}
