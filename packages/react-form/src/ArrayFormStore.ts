import type { ArrayFormStoreInterface, CreateArrayFormOptions } from "./types";
import type { IdType } from "@phragon/validator";
import FormStore from "./FormStore";
import FStore from "./FStore";
import { action, computed, flow, makeObservable, observable } from "mobx";

const FORM_ID = Symbol("form.id");

type FormPrivate<D = any> = {
	id?: keyof D;
	min: number;
	max?: number;
	autoId(value: D): IdType;
	items: FormValue<D>[];
};

type FormValue<D = any> = { id: IdType; isNew: boolean; value: D };

function createAutoId() {
	let autoId = 0;
	return () => {
		return `__AUTO_#ID${autoId++}__`;
	};
}

function getId<D extends {}>(store: ArrayFormStore<D>, value: D) {
	const tool = store[FORM_ID];
	const id = tool.id;
	if (id) {
		const val = value && (value as any)[id];
		if (typeof val === "string" || typeof val === "number") {
			return val;
		}
	}
	return tool.autoId(value);
}

function find(id: IdType, store: ArrayFormStore) {
	return store[FORM_ID].items.find((item) => item.id === id);
}

function findIndex(id: IdType, store: ArrayFormStore) {
	return store[FORM_ID].items.findIndex((item) => item.id === id);
}

function refill<D extends {}>(self: ArrayFormStore<D>) {
	self.idList = [];
	self.form = [];
	self[FORM_ID].items.forEach(({ id, value }) => {
		self.idList.push(id);
		self.form.push(value);
	});
	if (self.parent) {
		self.parent.fromChild((store) => {
			store.set(self.name, self.form);
		});
	}
}

export default class ArrayFormStore<D extends {} = any> extends FStore<D[]> implements ArrayFormStoreInterface<D> {
	private readonly _validateArray: Function | undefined = undefined;
	[FORM_ID]: FormPrivate<D>;

	form: D[] = [];
	idList: IdType[] = [];

	get length() {
		return this.form.length;
	}

	get idHash() {
		return this.idList.reduce((a: string, b) => `${a}::${b}`, "");
	}

	constructor(name: string, options: CreateArrayFormOptions<D> = {}, parent?: FormStore | ArrayFormStore) {
		super("array-form", name, parent, options.validators, options.submit);
		const { id, initValues, validateArray, len, autoId } = options;
		this[FORM_ID] = {
			id,
			autoId: typeof autoId === "function" ? autoId : createAutoId(),
			min: 0,
			items: [],
		};
		const tool = this[FORM_ID];
		let { min, max } = options;
		if (typeof len === "number" && len > 0) {
			min = len;
			max = len;
		}
		if (typeof min === "number" && min > 0) {
			tool.min = min;
		}
		if (typeof max === "number" && max >= tool.min) {
			tool.max = max;
		}
		if (Array.isArray(initValues)) {
			this.form = initValues;
			tool.items = this.form.map((value) => {
				const id = getId(this, value);
				this.idList.push(id);
				return {
					id,
					isNew: false,
					value,
				};
			});
		}
		if (typeof validateArray === "function") {
			this._validateArray = validateArray;
		}

		// observer

		makeObservable(this, {
			form: observable,
			errors: observable,
			submitError: observable,
			expectant: observable,
			idList: observable,
			wait: computed,
			idHash: computed,
			fill: action,
			empty: action,
			add: action,
			del: action,
			move: action,
			set: action,
			validate: action,
			setError: action,
			setSubmitError: action,
			submit: flow,
		});
	}

	has(id: IdType): boolean {
		return findIndex(id, this) !== -1;
	}

	getIndexId(index: number): IdType | null {
		const { items } = this[FORM_ID];
		if (index >= 0 && index < items.length) {
			return items[index].id;
		}
		return null;
	}

	validate() {
		const { items, min, max } = this[FORM_ID];
		const vKeys: IdType[] = Object.keys(this._validators);
		const err = (error: string) => {
			if (this.parent) {
				this.parent.setError(this.name, error);
			} else {
				this.setSubmitError(error);
			}
			return false;
		};

		let valid = true;

		if (vKeys.length > 0) {
			for (const key of vKeys) {
				if (this._valid(key, this.get(key)) != null) {
					valid = false;
				}
			}
		}

		if (this._validatorGlobal) {
			for (const item of items) {
				if (!vKeys.includes(item.id) && this._valid(item.id, item.value) != null) {
					valid = false;
				}
			}
		}

		// validate all records

		if (items.length < min) {
			return err("Too few entries in the collection");
		}

		if (max && max < items.length) {
			return err("Too many entries in the collection");
		}

		if (this._validateArray) {
			let error: string | null;
			try {
				error = this._validateArray(this.toJSON());
			} catch (err) {
				error = (err as Error).message || "Invalid collection data";
			}
			if (error != null) {
				return err(error);
			}
		}

		return valid;
	}

	fill(data: D[] = []) {
		if (!Array.isArray(data)) {
			return;
		}

		const keys = this[FORM_ID].items.map((item) => item.id);
		const fill: FormValue[] = [];

		this[FORM_ID].items = data.map((value) => {
			const id = getId(this, value);
			const index = keys.indexOf(id);
			const item: FormValue = {
				id,
				isNew: false,
				value,
			};
			if (index === -1) {
				keys.splice(index, 1);
				fill.push(item);
			}
			return item;
		});

		if (!this._fromChild) {
			fill.forEach((item) => {
				const child = this._children[item.id];
				if (child) {
					child.fill(item.value);
				}
			});
		}

		keys.forEach((key) => {
			delete this._children[key];
		});

		// update parent
		refill(this);
	}

	empty() {
		// empty child
		if (!this._fromChild) {
			this._eachChild((child) => {
				if (child) {
					child.empty();
				}
			});
		}

		this._children = {};

		// clear data
		this[FORM_ID].items = [];

		// update parent
		refill(this);
	}

	add(value: D, insertAfterId?: IdType): IdType {
		const id = getId(this, value);
		const item: FormValue = {
			id,
			isNew: true,
			value,
		};
		const { items } = this[FORM_ID];
		if (insertAfterId != null) {
			let index = findIndex(insertAfterId, this);
			if (index === -1 || ++index === items.length) {
				items.push(item);
			} else {
				items.splice(index, 0, item);
			}
		} else {
			items.unshift(item);
		}
		refill(this);
		return id;
	}

	del(id: IdType): void {
		const index = findIndex(id, this);
		if (index !== -1) {
			delete this._children[id];
			this[FORM_ID].items.splice(index, 1);
			refill(this);
		}
	}

	move(id: IdType, beforeId: IdType | null): void {
		const index = findIndex(id, this);
		if (index === -1) {
			return;
		}
		const { items } = this[FORM_ID];
		if (beforeId != null) {
			let beforeIndex = findIndex(beforeId, this);
			if (beforeIndex === -1 || beforeIndex === index) {
				return;
			}
			if (beforeIndex > index) {
				beforeIndex--;
			}
			const move = items.splice(index, 1);
			items.splice(beforeIndex, 0, ...move);
		} else if (index === items.length - 1) {
			return;
		} else {
			const move = items.splice(index, 1);
			items.push(...move);
		}
		refill(this);
	}

	set(id: IdType, value: D): void {
		const val = find(id, this);
		if (!val) {
			return;
		}
		val.value = value;

		// update child
		if (!this._fromChild) {
			const child = this._children[id];
			if (child) {
				child.fill(value);
			}
		}

		// update parent
		refill(this);
	}

	get(id: IdType): FormValue<D> | undefined {
		const val = find(id, this);
		if (val) {
			return {
				...val,
			};
		}
	}

	forEach<Result = D>(callback: (item: D, id: IdType, index: number) => Result): void {
		this[FORM_ID].items.forEach(({ value, id }, index) => callback(value, id, index));
	}

	map<Result = D>(callback: (item: D, id: IdType, index: number) => Result): Result[] {
		return this[FORM_ID].items.map(({ value, id }, index) => callback(value, id, index));
	}
}
