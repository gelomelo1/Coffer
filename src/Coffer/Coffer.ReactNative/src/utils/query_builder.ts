import { QueryFilterData, QueryOptions } from "../types/helpers/query_data";

export default function buildQuery(options: QueryOptions): string {
  if (!options.filters && !options.sort && !options.page && !options.pageSize) {
    return "";
  }
  let url = "?";
  if (options.filters) {
    url += "filter=";
  }
  options.filters?.forEach((filter, index) => {
    if (index > 0) {
      url += options.filterConjunction === "OR" ? " OR " : " AND ";
    }
    url += buildFilter(filter);
  });
  if (options.sort) {
    url += (options.filters ? "&" : "") + "orderBy=";
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
    url += `page=${options.page}`;
  }
  if (options.pageSize) {
    url += (options.page ? "&" : "") + `pageSize=${options.pageSize}`;
  }

  console.log(url);

  let encoded = encodeURI(url)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/&&/g, "%26%26");

  encoded = encoded.replace(/(?<=[^?&]+)=/g, (match, offset, str) => {
    const prev = str[offset - 1];
    if (
      /filter|orderBy|page|pageSize/i.test(
        str.slice(0, offset).split(/[?&]/).pop() || ""
      )
    ) {
      return match;
    }
    return "%3D";
  });

  return encoded;
}

function buildFilter(filter: QueryFilterData): string {
  let filterString = String(filter.field);

  const isCaseInSensitive = (filter as any).isCaseInSensitive ? true : false;

  if (isCaseInSensitive) {
    filterString += ".ToLower()";
  }

  if (filter.filter === "None") {
    // raw LINQ support
    return filter.field;
  }

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
    // number or date
    if (typeof filter.value === "number") {
      filterString += `${filter.filter}${filter.value}`;
    } else {
      const date = filter.value as Date;
      const firstDayOfMonth = `DateTime(${date.getFullYear()}, ${
        date.getMonth() + 1
      }, 1, 0, 0, 0, DateTimeKind.Utc)`;
      const month = date.getMonth() + 2;
      const year = month > 12 ? date.getFullYear() + 1 : date.getFullYear();
      const adjustedMonth = month > 12 ? 1 : month;

      const lastDayOfMonth = `DateTime(${year}, ${adjustedMonth}, 1, 0, 0, 0, DateTimeKind.Utc)`;
      filterString += `${filter.filter}${
        filter.filter === ">" || filter.filter === ">="
          ? lastDayOfMonth
          : firstDayOfMonth
      }`;
    }
  } else {
    // string filters
    if (filter.filter === "Match") {
      if (isCaseInSensitive) {
        filterString += `=="${filter.value.toLocaleLowerCase()}"`;
      } else {
        filterString += `=="${filter.value}"`;
      }
    } else {
      if (isCaseInSensitive) {
        filterString += `.${filter.filter}("${filter.value.toLocaleString()}")`;
      } else {
        filterString += `.${filter.filter}("${filter.value}")`;
      }
    }
  }

  return filterString;
}
