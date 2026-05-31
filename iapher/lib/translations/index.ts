import { en } from './en'
import { kh } from './kh'
import { ga } from './ga'
import { pn } from './pn'
import type { Lang } from '../questions/bank'

const translations = { en, kh, ga, pn }

export function t(lang: Lang, key: keyof typeof en): string {
  const dict = translations[lang] as Partial<typeof en>
  return dict[key] ?? en[key]
}

export { en, kh, ga, pn }
