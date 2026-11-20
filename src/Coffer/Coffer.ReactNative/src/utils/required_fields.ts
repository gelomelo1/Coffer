/**
 * Which fields must have a value before a waiting cap can be added. Same rules as the server
 * (Coffer.BusinessLogic.Pending.RequiredAttributes): the primary attribute is always required; text-like values must
 * not be blank, numbers and dates must be set, and a yes/no always counts (false is an answer).
 */

/** The parts of an Attribute these rules need (kept structural so the node unit tests don't load enums). */
export interface FieldAttribute {
  id: number;
  name: string;
  /** AttributeDataTypes: 0 String, 1 Number, 2 Date, 3 Boolean, 4 Select, 5 Multi_Select, 6 Autocomplete */
  dataType: number;
  primary: boolean;
  required?: boolean;
}

const NUMBER = 1;
const DATE = 2;
const BOOLEAN = 3;

export function isRequired(attribute: { primary: boolean; required?: boolean }): boolean {
  return attribute.primary || !!attribute.required;
}

export function isFilled(attribute: FieldAttribute, value: unknown): boolean {
  switch (attribute.dataType) {
    case BOOLEAN:
      return true;
    case NUMBER:
      return typeof value === "number" && !Number.isNaN(value);
    case DATE:
      return typeof value === "string" ? value.trim().length > 0 : value instanceof Date;
    default:
      return typeof value === "string" && value.trim().length > 0;
  }
}

/** Required fields first (primary on top, then attribute order), then the optional ones. */
export function orderFields<T extends FieldAttribute>(attributes: T[]): { required: T[]; optional: T[] } {
  const byRank = (a: T, b: T) => Number(b.primary) - Number(a.primary) || a.id - b.id;
  return {
    required: attributes.filter(isRequired).sort(byRank),
    optional: attributes.filter((a) => !isRequired(a)).sort(byRank),
  };
}

/** Required attributes without a value, in the order the form shows them. */
export function missingRequired<T extends FieldAttribute>(attributes: T[], values: Record<number, unknown>): T[] {
  return orderFields(attributes).required.filter((a) => !isFilled(a, values[a.id]));
}
