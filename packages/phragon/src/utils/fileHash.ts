import { createHash } from "crypto";
import { createReadStream } from "fs";

export default function fileHash(file: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const output = createHash("md5");
		const input = createReadStream(file);

		input.on("error", (err) => {
			reject(err);
		});

		output.once("readable", () => {
			resolve(output.read().toString("hex"));
		});

		input.pipe(output);
	});
}
