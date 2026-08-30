export const SERVICE_DRAG_TYPE = 'application/x-credvaultix-service'
export const SERVICE_FIELD_DRAG_TYPE = 'application/x-credvaultix-service-field'

export function hasDragType(types: readonly string[], expectedType: string) {
  return types.includes(expectedType)
}
