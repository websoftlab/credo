import {useEffect, useLayoutEffect} from "react";
import {useHistory, useLocation, useParams, useRouteMatch} from "react-router-dom";

export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const useRouter = () => {
	const history = useHistory();
	const location = useLocation();
	const params = useParams();
	const match = useRouteMatch();
	return {
		history,
		location,
		params,
		match,
	};
}