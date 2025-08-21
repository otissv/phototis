import { isNullOrUndefined } from "@/lib/utils/isNullOrUndefined"

/**
 * Checks if a value empty.
 *
 * @param   value - The value to be evaluated.
 *
 * @returns Returns true if value is empty, else returns false.
 *
 * @usage
 * `import \{ isEmpty \} from "c-ufunc/libs/isEmpty"`
 *
 * @example
 * ```
 * isEmpty(null) // true
 * isEmpty(undefined) // true
 * isEmpty([]) // true
 * isEmpty([undefined]) // true
 * isEmpty({}) // true
 * isEmpty('') // true
 * isEmpty(new Date()) // false
 *```
 */
export const isEmpty = <Value>(value: Value): boolean => {
  const type: string = typeof value

  switch (true) {
    case isNullOrUndefined(value):
    case (value as any).length === 0:
    case Array.isArray(value) &&
      value.filter(<V>(v: V) => typeof v === "undefined").length ===
        value.length:
      return true

    case type === "boolean":
    case type === "number":
    case type === "function":
    case value instanceof Date:
      return false

    case type === "object":
      return !Object.keys(value as object).length

    default:
      return !value
  }
}
