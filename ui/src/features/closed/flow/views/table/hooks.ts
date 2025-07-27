import { useSearchParams } from "wouter";
import type { SetSearchParams } from "wouter";

type StringParam = string | null;

type ReturnType = [
	{ flowID: StringParam; filterID: StringParam; limit: number; currentPage: number },
	URLSearchParams,
	SetSearchParams,
];

export const useFilterParams = (): ReturnType => {
	const [searchParams, setSearchParams] = useSearchParams();

	const flowID = searchParams.get("id");
	const filterID = searchParams.get("filterID");

	const limit = Number(searchParams.get("limit")) || 25;
	const currentPage = Number(searchParams.get("page")) || 1;

	return [{ flowID, filterID, limit, currentPage }, searchParams, setSearchParams];
};
