import { createContext, useContext, type ReactNode } from 'react'

// Kept apart from ConfirmDialog.tsx so that file only exports components
// (React Fast Refresh needs that to hot-reload it).

export interface ConfirmOptions {
  title: string
  /** Text is wrapped in a paragraph; other content is shown as it is. */
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive action: the confirm button is styled as such. */
  danger?: boolean
}

export interface PromptOptions {
  title: string
  label: string
  initialValue?: string
  confirmLabel?: string
}

export interface ConfirmApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Resolves to the trimmed text, or null when cancelled. */
  prompt: (options: PromptOptions) => Promise<string | null>
}

export const ConfirmContext = createContext<ConfirmApi | null>(null)

function useApi(): ConfirmApi {
  const api = useContext(ConfirmContext)
  if (!api) throw new Error('useConfirm/usePrompt need a <ConfirmProvider> above them')
  return api
}

/** `if (!(await confirm({ title, danger: true }))) return` */
export const useConfirm = () => useApi().confirm
export const usePrompt = () => useApi().prompt
