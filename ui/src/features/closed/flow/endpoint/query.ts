import { $api } from "@services";

import type { Filter, Flow, FlowDetailed } from "../model";

export interface TablePagination {
	current_page: number;
	limit: number;
	total_flows: number;
	total_pages: number;
	next_page: number;
}

export interface ApiResponse {
	data: Flow[];
	pagination: TablePagination;
}

interface GetListParams {
	page: number;
	limit: number;
	filterID?: string | null | undefined;
}

export const getList = async (params: GetListParams, signal?: AbortSignal) => {
	const searchParams = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });

	if (params.filterID) {
		searchParams.append("filterID", params.filterID);
	}

	return await $api<ApiResponse>(`flows/all?${searchParams.toString()}`, { signal });
};

export const getFlow = async (id: Flow["id"], signal?: AbortSignal) =>
	await $api<FlowDetailed>(`flows/${id}`, { signal });

export const getTotal = async (signal?: AbortSignal) => await $api<number>(`flows/total`, { signal });

export const getTotalOverTime = async (signal?: AbortSignal) => await $api(`dashboard/total`, { signal });

export const getFilters = () => $api<unknown>("flows/filters");
export const saveFilter = (filter: Filter) =>
	$api.post<unknown>(`flows/filters/${filter.id}`, { body: JSON.stringify(filter) });
export const deleteFilter = (filterID: Filter["id"]) => $api.delete(`flows/filters/${filterID}`);
