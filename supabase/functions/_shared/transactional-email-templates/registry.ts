/// <reference types="npm:@types/react@18.3.1" />
import type { ComponentType } from 'npm:react@18.3.1'

import { template as storeWelcome } from './store-welcome.tsx'
import { template as orderStatusUpdate } from './order-status-update.tsx'

export interface TemplateEntry<Props = any> {
  component: ComponentType<Props>
  subject: string | ((data: Props) => string)
  displayName?: string
  previewData?: Props
  to?: string | ((data: Props) => string)
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'store-welcome': storeWelcome,
  'order-status-update': orderStatusUpdate,
}
