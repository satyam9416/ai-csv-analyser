import validator from "validator";

export function validateInput(input: string | undefined | null): boolean {
  if (!input || typeof input !== "string") return false;
  if (input.length > 1000) return false;
  return validator.escape(input) === input;
}
