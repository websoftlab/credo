import { PhragonPlugin } from "../types";
import { copy, createCwdDirectoryIfNotExists, existsStat } from "./index";
import { dirname, join } from "node:path";
import { newError } from "@phragon/cli-color";
import { debug } from "../debug";
import isEmptyDir from "./isEmptyDir";

/**
 * if src-client directory is empty copy driver template
 *
 * @param driver
 */
export default async function copyTemplateIfEmpty(driver: PhragonPlugin.RenderDriver) {
	const dest = await createCwdDirectoryIfNotExists("src-client");
	if (!(await isEmptyDir(dest))) {
		return;
	}

	let src = `${driver.modulePath}/package.json`;
	try {
		src = require.resolve(src);
		src = join(dirname(src), "template");
	} catch (err) {
		throw newError(`Cannot resolve render module path {yellow %s}`, driver.modulePath);
	}

	const stat = await existsStat(src);
	if (!stat || !stat.isDirectory || (await isEmptyDir(src))) {
		return debug("Default page template not found for the {cyan %s} module", driver.modulePath);
	}

	await copy(src, dest);
}
