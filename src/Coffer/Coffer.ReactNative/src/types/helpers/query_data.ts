export interface CreateDataPayload<T> {
  id?: string | number;
  value: T;
}

export interface UpdateDataPayload<T> {
  id: string | number;
  value: T;
}

export type QueryFilterData<T> =
  | {
      filter: "Match" | "Contains" | "StartsWith" | "EndsWith";
      field: Extract<keyof T, string>;
      value: string;
    }
  | {
      filter: "==" | "<" | "<=" | ">" | ">=" | "!=";
      field: Extract<keyof T, number>;
      value: number;
    }
  | {
      filter?: never;
      field: Extract<keyof T, boolean>;
      value: boolean;
    };

export interface QuerySortData {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions<T> {
  filters?: QueryFilterData<T>[];
  sort?: QuerySortData[];
  page?: number;
  pageSize?: number;
  filterConjunction?: "AND" | "OR";
}
