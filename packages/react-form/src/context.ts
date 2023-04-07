import type { FormInputHook, ArrayFormInputHook, CreateFormOptions, CreateArrayFormOptions } from "./types";
import type { ReactNode, ChangeEvent, FormHTMLAttributes, FormEventHandler } from "react";
import { createContext, useContext, useMemo, useCallback, useState, useRef, useEffect, createElement } from "react";
import { default as FormStore } from "./FormStore";
import { default as ArrayFormStore } from "./ArrayFormStore";
import { reaction } from "mobx";

export const FormContext = createContext<FormStore | null>(null);

export const ArrayFormContext = createContext<ArrayFormStore | null>(null);

export function useFormStore<D extends {} = any>(): FormStore<D> {
	const store = useContext<FormStore<D> | null>(FormContext);
	if (!store) {
		throw new Error("Form context not defined in parent tree");
	}
	return store;
}

export function useArrayFormStore<D extends {} = any>(): ArrayFormStore<D> {
	const store = useContext<ArrayFormStore<D> | null>(ArrayFormContext);
	if (!store) {
		throw new Error("Form array context not defined in parent tree");
	}
	return store;
}

function parent(store: FormStore | ArrayFormStore): FormStore | ArrayFormStore {
	while (true) {
		const parent = store.parent;
		if (parent) {
			store = parent;
		} else {
			break;
		}
	}
	return store;
}

export function useStore() {
	const store1 = useContext(FormContext);
	const store2 = useContext(ArrayFormContext);
	if (store1) {
		return parent(store1);
	}
	if (store2) {
		return parent(store2);
	}
	throw new Error("Form context not defined in parent tree");
}

export function useParentStore() {
	const store1 = useContext(FormContext);
	const store2 = useContext(ArrayFormContext);
	if (store1) {
		if (store2) {
			let parent: FormStore | ArrayFormStore | undefined = store2;
			while (parent) {
				parent = parent.parent;
				if (!parent) {
					break;
				}
				if (parent === store1) {
					return store2;
				}
			}
		}
		return store1;
	}
	if (store2) {
		return store2;
	}
}

export function useSubmitWait() {
	const store = useStore();
	const [wait, setWait] = useState(store.wait);
	const onSubmit: FormEventHandler = useCallback(() => {
		store.submit();
	}, [store]);

	useEffect(
		() =>
			reaction(
				() => store.wait,
				(value) => {
					setWait(value);
				}
			),
		[]
	);

	return {
		store,
		wait,
		onSubmit,
	};
}

export function useSubmitError() {
	const store = useStore();
	const [message, setMessage] = useState(store.submitError);
	const setError = useCallback(
		(message: string | null) => {
			if (!store.wait) {
				store.setSubmitError(message);
			}
		},
		[store]
	);

	useEffect(
		() =>
			reaction(
				() => store.submitError,
				(value) => {
					setMessage(value);
				}
			),
		[]
	);

	return {
		store,
		setError,
		message,
	};
}

type FormHookType<Val = string> = {
	value: Val | undefined;
	disabled: boolean;
	error: string | string[] | null;
	touch: boolean;
	required: boolean;
};

function createFormState<Val>(name: string, init: boolean, store: FormStore) {
	const form: FormHookType<Val> = {
		value: store.get<Val>(name),
		required: store.required(name),
		disabled: init ? false : store.wait,
		error: init ? null : store.getError(name),
		touch: init ? false : store.touched(name),
	};
	if (form.value == null) {
		form.value = "" as never;
	}
	return form;
}

function compareFormState<Val>(last: FormHookType<Val>, next: FormHookType<Val>) {
	const value = next.value;
	const required = next.required;
	const error = next.error;
	const disabled = next.disabled;
	const touch = next.touch;
	return (
		last.value === value &&
		last.required === required &&
		last.error === error &&
		last.disabled === disabled &&
		last.touch === touch
	);
}

export function useFormValue<Type = string>(name: string) {
	const store = useFormStore();
	const [value, setValue] = useState<Type>(store.form[name]);
	useEffect(() => reaction(() => store.form[name], setValue), [store, name]);
	return value;
}

export function useFormHook<Val = string, E extends HTMLInputElement = HTMLInputElement>(
	name: string
): FormInputHook<Val, E> {
	const store = useFormStore();

	// callbacks
	const setValue = useCallback(
		(value: Val) => {
			store.set(name, value);
		},
		[store, name]
	);
	const onChangeHandler = useCallback(
		(event: ChangeEvent<E>) => {
			const target = event.target;
			if (target.type === "checkbox") {
				store.set(name, event.target.checked);
			} else {
				store.set(name, event.target.value);
			}
		},
		[store, name]
	);
	const onBlurHandler = useCallback(() => {
		store.sanitize(name);
	}, [store, name]);

	// value
	const [data, setData] = useState<FormHookType<Val>>(() => createFormState<Val>(name, true, store));
	const ref = useRef<FormHookType<Val>>(data);

	useEffect(() => {
		const next = createFormState<Val>(name, false, store);
		if (!compareFormState(ref.current, next)) {
			ref.current = next;
			setData(ref.current);
		}
		return reaction(
			() => createFormState<Val>(name, false, store),
			(next) => {
				ref.current = next;
				setData(ref.current);
			},
			{
				equals: compareFormState,
			}
		);
	}, [store, name]);

	return {
		name,
		store,
		setValue,
		error: data.error,
		touch: data.touch,
		required: data.required,
		props: {
			name,
			disabled: data.disabled,
			required: data.required,
			value: data.value,
			onChange: onChangeHandler,
			onBlur: onBlurHandler,
		},
	};
}

export function useArrayFormHook<Val = string>(): ArrayFormInputHook<Val> {
	const store = useArrayFormStore();
	const name = store.name;
	const setValues = useCallback(
		(values: Val[]) => {
			store.fill(values);
		},
		[store, name]
	);
	return {
		name,
		store,
		error: null, // todo
		setValues,
	};
}

function useParent(ctx: FormStore | ArrayFormStore, name: string, parent?: FormStore | ArrayFormStore) {
	useEffect(() => {
		if (parent) {
			if (!parent.has(name)) {
				parent.set(name, ctx.form);
			}
			parent.setChild(name, ctx);
			return () => {
				parent.delChild(name);
			};
		}
	}, [name, parent || null]);
}

export function useCreateForm<D extends {} = any>(name: string, options?: CreateFormOptions): FormStore<D> {
	const parent = useParentStore();
	const ctx = useMemo(() => new FormStore<D>(name, options, parent), [name]);
	useParent(ctx, name, parent);
	return ctx;
}

export function useCreateArrayForm<D extends {} = any>(
	name: string,
	options?: CreateArrayFormOptions
): ArrayFormStore<D> {
	const parent = useParentStore();
	const ctx = useMemo(() => new ArrayFormStore<D>(name, options, parent), [name]);
	useParent(ctx, name, parent);
	return ctx;
}

export interface FormProps<D extends {} = any> extends FormHTMLAttributes<HTMLFormElement> {
	provider: CreateFormOptions<D>;
	name: string;
	children: ReactNode | ReactNode[];
}

export function Form<D extends {} = any>(props: FormProps<D>) {
	const { name, provider, children, ...form } = props;
	const { onSubmit } = form;
	const store = useCreateForm<D>(name, provider);
	form.onSubmit = useCallback(
		(async (event) => {
			if (typeof onSubmit === "function") {
				onSubmit(event);
			}
			if (event.defaultPrevented) {
				return;
			}
			event.preventDefault();
			if (!store.wait) {
				await store.submit();
			}
		}) as FormEventHandler<HTMLFormElement>,
		[store, onSubmit]
	);
	return createElement(FormContext.Provider, { value: store }, createElement("form", form, children));
}

type ProviderProps<Store> = {
	name: string;
	children: ReactNode | ReactNode[];
} & Store;

export type FormProviderProps<D extends {} = any> = ProviderProps<CreateFormOptions<D>>;

export type ArrayFormProviderProps<D extends {} = any> = ProviderProps<CreateArrayFormOptions<D>>;

export function FormProvider<D extends {} = any>(props: FormProviderProps<D>) {
	const { name, children, ...options } = props;
	const store = useCreateForm<D>(name, options);
	return createElement(FormContext.Provider, { value: store }, children);
}

export function ArrayFormProvider<D extends {} = any>(props: ArrayFormProviderProps<D>) {
	const { name, children, ...options } = props;
	const store = useCreateArrayForm<D>(name, options);
	return createElement(ArrayFormContext.Provider, { value: store }, children);
}
