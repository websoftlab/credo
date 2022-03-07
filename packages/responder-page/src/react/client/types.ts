import type {API} from "../../types";
import type {ElementType} from "react";

export interface ClientOptions {
	bootloader?: ((api: API.ApiInterface<ElementType>) => void)[]
}
