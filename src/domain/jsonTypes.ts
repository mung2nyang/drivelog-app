export type JsonValue = string | number | boolean | null | JsonArray | JsonRecord
export type JsonArray = Array<JsonValue>
export type JsonRecord = { [key: string]: JsonValue }
