
export class ObjectDescriptor implements PropertyDescriptor {
	configurable?: boolean;
	enumerable?: boolean;
	value?: any;
	writable?: boolean;
	get?(): any;
	set?(v: any): void;
	constructor(descriptor: PropertyDescriptor) {
		Object.assign(this, descriptor);
	}
}

export default function objectDefineProperty(object: any, name: string, value: any | ObjectDescriptor, descriptor: PropertyDescriptor = {}) {
	Object.defineProperty(object, name, value instanceof ObjectDescriptor ? {
		... descriptor,
		... value,
	} : {
		... descriptor,
		value,
	});
}
