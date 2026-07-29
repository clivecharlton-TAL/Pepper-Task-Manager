export interface TeamMember {
  name: string
  role: string
  email: string
}

// Emails follow firstname.lastname@takealot.com
function emailFor(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '.') + '@takealot.com'
}

const ROSTER: [string, string][] = [
  // CTO
  ['Clive Charlton',    'CTO'],
  // CTO direct reports
  ['Filipe Teixeira',   'Sr Eng Director, Group Fulfilment'],
  ['Mario De Freitas',  'Eng Director, Storefront'],
  ['Jonathan Muir',     'CTO, Mr D'],
  ['Pieter Rautenbach', 'Eng Director, Merchant'],
  ['Charles Brittz',    'Eng Director, Group QA'],
  ['William Howard',    'Eng Director, Platform'],
  ['Danie Nagel',       'Eng Director, Data'],
  ['Axel Tidemann',     'Group Head of AI'],
  ['Ryan Hendriks',     'Head of Strategy & Innovation'],
  ['Renier Hugo',       'Group CIO, Group IT'],
  ['Nic Torr',          'Principal Engineer, SRE'],
  ['Stii Pretorius',    'Principal Engineer, Group QA'],
  // Principals
  ['Damon Hook',        'Principal Eng, Storefront'],
  ['Cobus Carstens',    'Principal Eng, Merchant'],
  ['Charles Van Wyk',   'Principal SE, SRE'],
  ['Jacques Botha',     'Principal SE, SRE'],
]

export const TEAM_MEMBERS: TeamMember[] = ROSTER.map(([name, role]) => ({
  name, role, email: emailFor(name),
}))

// Build a regex that matches @Name for any team member — used for display highlighting
const escaped = TEAM_MEMBERS.map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
export const MENTION_REGEX = new RegExp(`@(${escaped.join('|')})`, 'g')
