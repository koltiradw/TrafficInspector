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

type $ApiOptions = Pick<Options, "signal" | "body">;

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

const api = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance(url as Input, options));

api.get = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.get(url as Input, options));
api.put = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.put(url as Input, options));
api.post = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.post(url as Input, options));
api.patch = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.patch(url as Input, options));
api.delete = async <T = AnyObject>(url: Partial<Input>, options?: $ApiOptions) =>
	parseNetResponse<T>(await kyInstance.delete(url as Input, options));

export default api;
