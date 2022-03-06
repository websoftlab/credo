export default async function asyncResult<T = any>(result: (T | Promise<T>)): Promise<T> {
	return result;
}