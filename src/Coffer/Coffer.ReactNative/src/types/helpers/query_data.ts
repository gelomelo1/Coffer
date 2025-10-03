export interface CreateDataPayload<T> {
  id?: string | number;
  value: T;
}

export interface UpdateDataPayload<T> {
  id: string | number;
  value: T;
}

//SUPPORT RAW LINQ, USE FIELD FOR RAW LINQ AND MATCH FILTER
export type QueryFilterData =
  | {
      filter: "Match" | "Contains" | "StartsWith" | "EndsWith";
      field: string;
      value: string;
    }
  | {
      filter: "==" | "<" | "<=" | ">" | ">=" | "!=";
      field: string;
      value: number;
    }
  | {
      filter?: never;
      field: string;
      value: boolean;
    };

export interface QuerySortData {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  filters?: QueryFilterData[];
  sort?: QuerySortData[];
  page?: number;
  pageSize?: number;
  filterConjunction?: "AND" | "OR";
}
