import React from "react";
import type { HeadManager } from "@credo-js/html-head";

const Context = React.createContext<HeadManager | null>(null);

const Provider = Context.Provider;

const Consumer = Context.Consumer;

const useHeadContext = () => {
	return React.useContext(Context);
};

export { Context, Provider, Consumer, useHeadContext };
