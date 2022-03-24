import {access} from "fs/promises";
import {constants} from "fs";

export default async function exists(file: string): Promise<boolean> {
	try {
		await access(file, constants.F_OK);
	} catch(err) {
		return false;
	}
	return true;
}