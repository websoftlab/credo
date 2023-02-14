import type { Context } from "koa";
import type { Dashboard } from "../types";
import { HttpPage } from "@phragon/responder-page";

export default async function homePageController(ctx: Context): Promise<any> {
	const title = ctx.store.translate("dashboard:title", "Dashboard");
	const response: Dashboard.WebResponse = {
		title,
		component: [
			{
				id: "header",
				name: "header",
				props: {
					title,
					text: ctx.store.translate("dashboard:welcome", "Welcome to PhragonJS Dashboard console."),
				},
			},
		],
	};
	return new HttpPage(response);
}
