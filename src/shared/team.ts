export interface TeamMember {
  name: string
  role: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  // CTO direct reports
  { name: 'Filipe Teixeira',   role: 'Sr Eng Director, Group Fulfilment' },
  { name: 'Mario De Freitas',  role: 'Eng Director, Storefront' },
  { name: 'Jonathan Muir',     role: 'CTO, Mr D' },
  { name: 'Pieter Rautenbach', role: 'Eng Director, Merchant' },
  { name: 'Charles Brittz',    role: 'Eng Director, Group QA' },
  { name: 'William Howard',    role: 'Eng Director, Platform' },
  { name: 'Danie Nagel',       role: 'Eng Director, Data' },
  { name: 'Axel Tidemann',     role: 'Group Head of AI' },
  { name: 'Ryan Hendriks',     role: 'Head of Strategy & Innovation' },
  { name: 'Renier Hugo',       role: 'Group CIO, Group IT' },
  { name: 'Nic Torr',          role: 'Principal Engineer, SRE' },
  { name: 'Stii Pretorius',    role: 'Principal Engineer, Group QA' },
  // Principals
  { name: 'Damon Hook',        role: 'Principal Eng, Storefront' },
  { name: 'Cobus Carstens',    role: 'Principal Eng, Merchant' },
  { name: 'Charles Van Wyk',   role: 'Principal SE, SRE' },
  { name: 'Jacques Botha',     role: 'Principal SE, SRE' },
]

// Build a regex that matches @Name for any team member — used for display highlighting
const escaped = TEAM_MEMBERS.map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
export const MENTION_REGEX = new RegExp(`@(${escaped.join('|')})`, 'g')
