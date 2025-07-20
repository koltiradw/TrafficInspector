import ky from "ky";
import type { KyResponse, Input, Options } from "ky";

import type { AnyObject } from "@shared/helpers/types";

export interface $ApiSuccess<T = AnyObject> {
	ok: true;
	data: T;
}

export interface $ApiFail {
	ok: false;
	error: string;
	code: number;
}

type $ApiOptions = Pick<Options, "signal">;

async function parseNetResponse<T = AnyObject>(res: KyResponse<unknown>) {
	let response: $ApiSuccess<T> | $ApiFail;

	switch (res.status) {
		case 200: {
			const resData: T = await res.json();
			response = { ok: true, data: resData };
			break;
		}
		case 500:
		case 501:
		case 503: {
			let error = "Request prompted an error";
			const resData: AnyObject = await res.json();
			if ("detail" in resData) {
				error = resData.detail as string;
			}
			response = { ok: false, error, code: res.status };
			break;
		}
		default:
			response = {
				ok: false,
				error: "Request prompted an error",
				code: res.status,
			};
			break;
	}
	// TODO: consider possible errors (network and backend); whether to use error from response

	return response;
}

const kyInstance = ky.create({
	prefixUrl: "/api/v1",
	timeout: 30000,
	retry: { limit: 1 },
	headers: { "Content-Type": "application/json" },
	throwHttpErrors: false,
});

const api = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance(url, options));
api.get = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.get(url, options));
api.put = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.put(url, options));
api.post = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.post(url, options));
api.patch = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.patch(url, options));
api.delete = async <T = AnyObject>(url: Input, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.delete(url, options));

export default api;
