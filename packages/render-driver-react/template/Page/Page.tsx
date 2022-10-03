import { PageProps } from "@phragon/render-driver-react/app";
import styles from "./Page.module.scss";

export interface Props {
	title: string;
	text: string;
}

export default function Page({ pageData: { title, text } }: PageProps<Props>) {
	return (
		<div className={styles.root}>
			<h1>{title}</h1>
			<p>{text}</p>
		</div>
	);
}
