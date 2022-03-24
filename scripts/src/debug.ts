import util from "util";
import {format} from "./color";

export default function debug(msg: string, ... args: any[]) {
	process.stdout.write(util.format(format(msg), ... args) + "\n");
}