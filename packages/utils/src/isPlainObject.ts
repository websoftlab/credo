/*!
 * Origin:
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

function isObject(o: any): boolean {
	return Object.prototype.toString.call(o) === "[object Object]";
}

export default function isPlainObject(o: any): boolean {
	if (!isObject(o)) return false;

	// If has modified constructor
	let ctor = o.constructor;
	if (ctor === undefined) return true;

	// If has modified prototype
	let proto = ctor.prototype;
	if (!isObject(proto)) return false;

	// If constructor does not have an Object-specific method
	if (!proto.hasOwnProperty("isPrototypeOf")) return false;

	// Most likely a plain Object
	return true;
}
