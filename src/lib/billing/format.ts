/** No currency symbol on purpose — the schema has no currency field, so this avoids asserting one that wasn't specified. */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
