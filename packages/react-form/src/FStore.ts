import type { Validator, ValidatorType, IdType } from "@phragon/validator";
import type { ActionHandler } from "./types";
import { createValidator } from "@phragon/validator";
import FormStore from "./FormStore";
import ArrayFormStore from "./ArrayFormStore";
import { clonePlainObject, isPlainObject, __isDev__, asyncResult } from "@phragon/utils";
import { action } from "mobx";

const FROM_CHILD_ID = Symbol();
const SUBMIT_ID = Symbol();
const STORE_ID = Symbol();

const arrayIdTypeRegExp = /^\[(\d+)]$/;

function getErrorIdType<R>(store: FStore<R>, name: string) {
	if (FStore.isArrayFormStore(store)) {
		const mt = name.match(arrayIdTypeRegExp);
		if (mt) {
			const id = store.getIndexId(parseInt(mt[1]));
			if (id != null) {
				return id;
			}
		}
	}
	return name;
}

export default abstract class FStore<R> {
	[FROM_CHILD_ID]: boolean = false;
	[SUBMIT_ID]: Function | undefined = undefined;
	[STORE_ID]: string;

	protected _validatorGlobal: Validator | undefined = undefined;
	protected _validators: Record<string, Validator> = {};
	protected _children: Record<string, ArrayFormStore | FormStore> = {};
	protected _requiredAll: boolean = false;
	protected _required: Record<IdType, boolean | undefined> = {};
	protected _actionList: ActionHandler<any>[] = [];
	protected _setExpectant: (store: FStore<R>, value: boolean) => void;

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
		this._setExpectant = action((store, value) => {
			store.expectant = value;
		});
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

	protected _emit<Action extends { type: string }>(action: Action): Action {
		if (this._actionList.length > 0) {
			for (const cb of this._actionList) {
				cb(action);
			}
		}
		return action;
	}

	protected _validNull(name: IdType) {
		delete this.errors[name];
		return null;
	}

	protected _valid<Val = string>(name: IdType, value: Val): null | string | string[] {
		let validator: Validator | null = null;
		let error: string | string[] | null | undefined = null;

		if (this._validators.hasOwnProperty(name)) {
			validator = this._validators[name];
		} else if (this._validatorGlobal) {
			validator = this._validatorGlobal;
		} else {
			const event = this._emit({ type: "valid", name, value, error });
			if (event.error != null) {
				error = event.error;
			} else {
				return this._validNull(name);
			}
		}

		if (validator != null) {
			try {
				error = validator(value, name);
			} catch (err) {
				error = (err as Error).message || "Invalid value";
			}
			const event = this._emit({ type: "valid", name, value, error });
			if (event.error != null) {
				error = event.error;
			}
		}

		if (error == null) {
			return this._validNull(name);
		}

		if (Array.isArray(error)) {
			if (error.length === 0) {
				return this._validNull(name);
			}
			if (error.length === 1) {
				error = error[0];
			}
		}

		this.errors[name] = this._emit({ type: "error", name, error }).error;
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

		this._setExpectant(this, true);

		const submit = this[SUBMIT_ID];
		if (typeof submit !== "function") {
			throw new Error("Submit function is not defined");
		}

		return asyncResult(submit(this._emit({ type: "submit", value: this.toJSON() }).value))
			.finally(() => {
				this._setExpectant(this, false);
			})
			.catch((err) => {
				let message: string | null = null;
				if (err instanceof Error) {
					message = err.message;
				} else if (typeof err === "string") {
					message = err;
				} else if (err != null) {
					if (typeof err.message === "string") {
						message = err.message;
					} else if (typeof err.toString === "function") {
						message = String(err);
					}
				}
				this.setSubmitError(message || "Unknown error");
			});
	}

	setError(name: IdType, value?: string | string[] | undefined | null): void {
		// set child error
		if (typeof name === "string") {
			const index = name.indexOf("."); // name.error
			if (index !== -1) {
				const child = this.getChild(getErrorIdType(this, name.substring(0, index)));
				if (child) {
					return child.setError(name.substring(index + 1), value);
				}
			}
			name = getErrorIdType(this, name);
		}

		if (FStore.isArrayFormStore(this)) {
			const child = this.getChild(name);
			value = Array.isArray(value) ? value[0] : value;
			if (child) {
				return child.setSubmitError(value);
			} else {
				return this.setSubmitError(value);
			}
		}

		// current error
		if (value == null || (Array.isArray(value) && value.length === 0)) {
			delete this.errors[name];
		} else {
			this.errors[name] = this._emit({ type: "error", name, error: value }).error;
		}
	}

	getError(name: IdType): string | string[] | null {
		return this.errors[name] || null;
	}

	setSubmitError(value?: string | undefined | null) {
		if (this.parent) {
			if (FStore.isArrayFormStore(this.parent)) {
				this.parent.setSubmitError(value);
			} else {
				this.parent.setError(this.name, value);
			}
		} else if (typeof value === "string" && value.length > 0) {
			this.submitError = this._emit({ type: "failure", message: value }).message;
		} else {
			this.submitError = null;
		}
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
		return clonePlainObject<R>(this._emit({ type: "json", data: this.form }).data);
	}

	subscribe<Action extends { type: string }>(action: ActionHandler<Action>) {
		if (typeof action === "function" && !this._actionList.includes(action)) {
			this._actionList.push(action);
		}
		return () => {
			const index = this._actionList.indexOf(action);
			if (index !== -1) {
				this._actionList.splice(index, 1);
			}
		};
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
