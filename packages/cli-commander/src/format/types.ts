export type FormatResult<T> = {
	valid: true,
		value: T
} | {
	valid: false,
		error: string
}

export interface FormatFunction<T, Det = never> {
	(value: string, detail?: Det): FormatResult<T>
}