import type { FocusEvent, ChangeEvent } from "react";
import type { IdType, Formatter, FormatterType, Validator, ValidatorType } from "@phragon/validator";

interface BaseFormStore<R> {
	readonly name: string;
	readonly wait: boolean;
	readonly parent?: FormStoreInterface | ArrayFormStoreInterface;
	errors: Record<IdType, string | string[]>;
	submitError: string | null;
	form: any;
	required(name: IdType): boolean;
	toJSON(): R;
	empty(): void;
	submit(): Generator;
	setChild(name: IdType, child: FormStoreInterface | ArrayFormStoreInterface): void;
	delChild(name: IdType): void;
	getChild(name: IdType): FormStoreInterface | ArrayFormStoreInterface | null;
	fromChild(callback: (store: this) => void): void;
	setError(name: IdType, value?: string | string[] | undefined | null): void;
	getError(name: IdType): string | string[] | null;
}

export interface FormStoreInterface<D = any> extends BaseFormStore<D> {
	has(name: IdType | keyof D): boolean;
	set<Val = string>(name: IdType | keyof D, value: Val): void;
	get<Val = string>(name: IdType | keyof D): Val | undefined;
	del(name: IdType | keyof D): void;
	fill(data: D, reset?: boolean): void;
	sanitize(name: IdType): boolean;
}

export interface ArrayFormStoreInterface<D = any> extends BaseFormStore<D[]> {
	has(id: IdType): boolean;
	add(value: D, insertAfterId?: IdType): IdType;
	del(id: IdType): void;
	set(id: IdType, value: D): void;
	get(id: IdType): { id: IdType; isNew: boolean; value: D } | undefined;
	move(id: IdType, beforeId: IdType | null): void;
	fill(data?: D[], reset?: boolean): void;

	getIndexId(index: number): IdType | null;
	forEach(callback: (item: D, id: IdType, index: number) => void): void;
	map<Result = D>(callback: (item: D, id: IdType, index: number) => Result): Result[];
}

interface CreateOptions<Values> {
	initValues?: Values;
	validators?: Validator | Record<IdType, ValidatorType | ValidatorType[]>;
	submit?(data: Values): void | Promise<void>;
}

export interface CreateArrayFormOptions<D extends {} = any> extends CreateOptions<D[]> {
	id?: keyof D;
	min?: number;
	max?: number;
	len?: number;
	autoId?(entry?: D): IdType;
	validateArray?(items: D[]): string | null;
}

export interface CreateFormOptions<D extends {} = any> extends CreateOptions<D> {
	formatters?: Formatter | Record<IdType | keyof D, Formatter>;
	sanitizers?: Formatter | Record<IdType | keyof D, FormatterType | FormatterType[]>;
}

interface FormHook<Store> {
	name: string;
	store: Store;
	error: string | string[] | null;
}

export interface FormInputHook<Val = string, E extends HTMLInputElement = HTMLInputElement>
	extends FormHook<FormStoreInterface> {
	setValue(value: Val): void;
	touch: boolean;
	required: boolean;
	props: {
		name: string;
		value: Val | undefined;
		disabled: boolean;
		required: boolean;
		onChange(event: ChangeEvent<E>): void;
		onBlur(event: FocusEvent<E>): void;
	};
}

export interface ArrayFormInputHook<Val = string> extends FormHook<ArrayFormStoreInterface> {
	setValues(values: Val[]): void;
}

export interface ActionHandler<Action extends { type: string }> {
	(action: Action): void;
}
