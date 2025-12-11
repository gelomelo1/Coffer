export interface CreateDataPayload<T> {
  id?: string | number;
  value: T;
}

export interface UpdateDataPayload<T> {
  id: string | number;
  value: T;
}

export type QueryFilterData =
  | {
      filter: "Match" | "Contains" | "StartsWith" | "EndsWith";
      field: string;
      value: string;
      isCaseInSensitive?: boolean;
    }
  | {
      filter: "==" | "<" | "<=" | ">" | ">=" | "!=";
      field: string;
      value: number | Date;
    }
  | {
      filter?: never;
      field: string;
      value: boolean;
    }
  | {
      filter: "None";
      field: string;
      value?: string;
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
