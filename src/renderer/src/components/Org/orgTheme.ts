import { ROOT_ID, managerChain, type OrgPerson } from '../../../../shared/org'

// One hue per stripe; every person below a direct report inherits that
// direct's hue so a division reads as one colour family on the canvas.
export const STRIPE_COLOURS: Record<string, string> = {
  'BU':                 '#E07A45',
  'Horizontal Enabler': '#4A9ECA',
  'Specialist':         '#B07CF0',
  'Group CIO scope':    '#4CAF82',
}
export const NEUTRAL = '#8E8E93'
export const ACCENT = '#c45d2e'

export function hueFor(person: OrgPerson, people: OrgPerson[]): string {
  if (person.id === ROOT_ID) return ACCENT
  const direct = person.manager_id === ROOT_ID
    ? person
    : managerChain(people, person.id).find(m => m.manager_id === ROOT_ID)
  return (direct?.stripe && STRIPE_COLOURS[direct.stripe]) || NEUTRAL
}

export const TIER_LABEL: Record<string, string> = {
  CTO: 'CTO', Director: 'DIR', EM2: 'EM2', EM1: 'EM1', Principal: 'PRIN', Other: '',
}
