import type { Locale } from "date-fns"
import { enUS } from "date-fns/locale"

/** English locale for date-fns so month names and relative time stay English regardless of browser settings. */
export const DATE_FNS_LOCALE: Locale = enUS
