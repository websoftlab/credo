import ValidateService from "./ValidateService";

let validateService: ValidateService | null = null;

export default function service() {
	if (validateService) {
		return validateService;
	}
	validateService = new ValidateService();
	return validateService;
}
