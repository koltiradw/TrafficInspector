import { useEffect, useState } from "react";
import type { Primitive } from "ky/distribution/types/common";

import { $api } from "@services";

export default function useFetch<Response, Default = undefined>(
	path: string,
	deps: Primitive[],
	opts: { interval?: number; defaultValue?: Default }
) {
	const [data, setData] = useState<Response | Default | undefined>(opts.defaultValue);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const doFetch = async (signal: AbortSignal) => {
		setIsLoading(true);
		const res = await $api.get<Response>(path, { signal });

		if (res.ok) {
			setError(null);
			setData(res.data);
		} else {
			setData(opts.defaultValue);
			setError(res.error);
		}

		setIsLoading(false);
	};

	useEffect(() => {
		const ctrl = new AbortController();
		let intervalId: NodeJS.Timeout;

		if (opts.interval !== undefined) {
			intervalId = setInterval(doFetch, opts.interval, ctrl.signal);
		}

		doFetch(ctrl.signal);

		return () => {
			ctrl.abort();
			if (intervalId) clearInterval(intervalId);
		};
	}, [...deps, opts.interval]);

	return { data, isLoading, error } as { data: Response | Default; isLoading: typeof isLoading; error: typeof error };
}
