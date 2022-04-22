export default function getError(error: string): { valid: false; error: string } {
	return {
		valid: false,
		error,
	};
}
