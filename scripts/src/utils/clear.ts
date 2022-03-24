import rimraf from "rimraf";

export default async function clear(path: string) {
	return new Promise<void>((resolve, reject) => {
		rimraf(path, (error) => {
			if(error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}