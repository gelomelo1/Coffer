import { QueryFilterData, QueryOptions } from "../types/helpers/query_data";

export default function buildQuery<T>(options: QueryOptions<T>): string {
  if (!options.filters && !options.sort && !options.page && !options.pageSize) {
    return "";
  }
  let url = "?";
  if (options.filters) {
    url += "Filter=";
  }
  options.filters?.forEach((filter, index) => {
    if (index > 0) {
      url += options.filterConjunction === "OR" ? " OR " : " AND ";
    }
    url += buildFilter(filter);
  });
  if (options.sort) {
    url += (options.filters ? "&" : "") + "OrderBy=";
  }
  options.sort?.forEach((sort, index) => {
    if (index > 0) {
      url += ", ";
    }
    url += `${sort.field} ${sort.direction}`;
  });
  if ((options.filters || options.sort) && (options.page || options.pageSize)) {
    url += "&";
  }
  if (options.page) {
    url += `Page=${options.page}`;
  }
  if (options.pageSize) {
    url += (options.page ? "&" : "") + `PageSize=${options.pageSize}`;
  }

  console.log(url);

  return encodeURI(url);
}

function buildFilter<T>(filter: QueryFilterData<T>): string {
  let filterString = String(filter.field); // <-- convert to string

  if (filter.filter === undefined) {
    // boolean
    filterString += `==${filter.value}`;
  } else if (
    filter.filter === "==" ||
    filter.filter === "<" ||
    filter.filter === "<=" ||
    filter.filter === ">" ||
    filter.filter === ">=" ||
    filter.filter === "!="
  ) {
    // number
    filterString += `${filter.filter}${filter.value}`;
  } else {
    // string
    if (filter.filter === "Match") {
      filterString += `=="${filter.value}"`;
    } else {
      filterString += `.${filter.filter}("${filter.value}")`;
    }
  }

  return filterString;
}
