import type { Validator, ValidatorType, IdType } from "@phragon/validator";
import { createValidator } from "@phragon/validator";
import FormStore from "./FormStore";
import ArrayFormStore from "./ArrayFormStore";
import { clonePlainObject, isPlainObject, __isDev__, asyncResult } from "@phragon/utils";

const FROM_CHILD_ID = Symbol();
const SUBMIT_ID = Symbol();
const STORE_ID = Symbol();

export default abstract class FStore<R> {
	[FROM_CHILD_ID]: boolean = false;
	[SUBMIT_ID]: Function | undefined = undefined;
	[STORE_ID]: string;

	protected _validatorGlobal: Validator | undefined = undefined;
	protected _validators: Record<string, Validator> = {};
	protected _children: Record<string, ArrayFormStore | FormStore> = {};
	protected _requiredAll: boolean = false;
	protected _required: Record<IdType, boolean | undefined> = {};

	errors: Record<string, string | string[]> = {};
	submitError: string | null = null;
	expectant: boolean = false;

	abstract form: R;

	protected constructor(
		storeType: string,
		public name: string,
		public readonly parent?: FormStore | ArrayFormStore,
		validators?: Record<string, ValidatorType | ValidatorType[]> | Validator,
		submit?: (data: R) => void | Promise<void>
	) {
		this[STORE_ID] = storeType;
		if (validators) {
			if (typeof validators === "function") {
				const { required, callback } = createValidator(validators);
				this._requiredAll = required;
				this._validatorGlobal = callback;
			} else if (isPlainObject(validators)) {
				for (const key of Object.keys(validators)) {
					const { required, callback } = createValidator(validators[key]);
					if (key === "*") {
						this._requiredAll = required;
						this._validatorGlobal = callback;
					} else {
						this._required[key] = required;
						this._validators[key] = callback;
					}
				}
			}
		}
		if (parent) {
			if (typeof submit === "function" && __isDev__()) {
				console.error("The submit function must not be defined on the child form");
			}
		} else if (typeof submit !== "function") {
			throw new Error("The submit function is required for the root form");
		} else {
			this[SUBMIT_ID] = submit;
		}
	}

	protected get _fromChild() {
		return this[FROM_CHILD_ID];
	}

	protected _eachChild(func: (child: ArrayFormStore | FormStore, key: IdType) => void) {
		for (const key of Object.keys(this._children)) {
			func(this._children[key], key);
		}
	}

	protected _validNull(name: IdType) {
		delete this.errors[name];
		return null;
	}

	protected _valid<Val = string>(name: IdType, value: Val): null | string | string[] {
		let validator: Validator;

		if (this._validators.hasOwnProperty(name)) {
			validator = this._validators[name];
		} else if (this._validatorGlobal) {
			validator = this._validatorGlobal;
		} else {
			return this._validNull(name);
		}

		let error: string | string[] | null | undefined;
		try {
			error = validator(value, name);
		} catch (err) {
			error = (err as Error).message || "Invalid value";
		}

		if (Array.isArray(error)) {
			if (error.length === 0) {
				error = null;
			} else if (error.length === 1) {
				error = error[0];
			}
		}

		if (error == null) {
			return this._validNull(name);
		}

		this.errors[name] = error;
		return error;
	}

	abstract has(name: IdType): boolean;
	abstract validate(): boolean;

	required(name: IdType) {
		return this._requiredAll || this._required[name] === true;
	}

	get wait(): boolean {
		if (this.parent) {
			return this.parent.wait;
		}
		return this.expectant;
	}

	*submit(): Generator {
		if (this.parent) {
			return this.parent.submit();
		}
		if (this.expectant) {
			throw new Error("The process is already running");
		}

		if (!this.validate()) {
			return;
		}

		this.expectant = true;

		const submit = this[SUBMIT_ID];
		if (typeof submit !== "function") {
			throw new Error("Submit function is not defined");
		}

		return asyncResult(submit(this.toJSON()))
			.finally(() => {
				this.expectant = false;
			})
			.catch((err) => {
				this.submitError = (err as Error).message || "Unknown error";
			});
	}

	setError(name: IdType, value?: string | string[] | undefined | null): void {
		// set child error
		if (typeof name === "string") {
			const index = name.indexOf("."); // name.error
			if (index !== -1) {
				const child = this.getChild(name.substring(0, index));
				if (child) {
					return child.setError(name.substring(index + 1), value);
				}
			}
		}

		// current error
		if (value == null || (Array.isArray(value) && value.length === 0)) {
			delete this.errors[name];
		} else {
			this.errors[name] = value;
		}
	}

	getError(name: IdType): string | string[] | null {
		return this.errors[name] || null;
	}

	setSubmitError(value?: string | undefined | null) {
		this.submitError = typeof value === "string" && value.length > 0 ? value : null;
	}

	fromChild(callback: (store: this) => void) {
		this[FROM_CHILD_ID] = true;
		callback(this);
		this[FROM_CHILD_ID] = false;
	}

	setChild(name: IdType, store: ArrayFormStore | FormStore): void {
		if (this._children[name] !== store) {
			if (!FStore.isStore(store)) {
				throw new Error("Store must be ArrayFormStore or FormStore");
			}
			if (!this.has(name)) {
				throw new Error("Child value not found");
			}
			this._children[name] = store;
		}
	}

	getChild(name: IdType): ArrayFormStore | FormStore | null {
		return this._children.hasOwnProperty(name) ? this._children[name] : null;
	}

	delChild(name: IdType): void {
		if (this._children.hasOwnProperty(name)) {
			delete this._children[name];
		}
	}

	toJSON(): R {
		return clonePlainObject<R>(this.form);
	}

	static isStore(store: any): store is FormStore | ArrayFormStore {
		return FStore.isFormStore(store) || FStore.isArrayFormStore(store);
	}

	static isFormStore(store: any): store is FormStore {
		return store && store[STORE_ID] === "form";
	}

	static isArrayFormStore(store: any): store is ArrayFormStore {
		return store && store[STORE_ID] === "array-form";
	}
}
