import { maybeString } from "@/lib/utils/maybeString"

/**
 * Transforms a string to uppercase.
 *
 * @param   string - String to be evaluated.
 *
 * @returns Return a string all in uppercase.
 *
 * @usage
 * `import { toUpper } from "c-ufunc/libs/toUpper"`
 *
 * @example
 * ```
 * toUpper("hello") // "HELLO"
 * ```
 */
export const toUpper = (string: string): string =>
  maybeString(string).toUpperCase()
