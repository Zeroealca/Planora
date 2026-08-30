/**
 * Exactly one option may be selected per item.
 * The database applies the same rule atomically via `select_item_option`.
 */
export function flagsForSingleSelection(
  optionIds: readonly string[],
  selectedId: string,
): { id: string; selected: boolean }[] {
  return optionIds.map((id) => ({ id, selected: id === selectedId }))
}
