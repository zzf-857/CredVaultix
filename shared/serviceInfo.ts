export type ServiceEditorMode = 'model-provider' | 'general'

export interface ModelProviderKeyCommand {
  fieldId: string
  fieldName?: string
  fieldValue?: string
  isSecret?: boolean
  purpose: string
  manualBalance: string
  sortOrder: number
}

export interface ModelProviderProfileCommand {
  providerId: string
  baseUrl: {
    fieldId: string
    fieldName?: string
    fieldValue?: string
  } | null
  keys: ModelProviderKeyCommand[]
  detachKeyIds: string[]
}

export interface ModelProviderProfileDetail {
  providerId: string
  baseUrlFieldId: string | null
  keys: Array<{
    fieldId: string
    purpose: string
    manualBalance: string
    sortOrder: number
  }>
}
