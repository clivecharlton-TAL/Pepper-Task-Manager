import { MENTION_REGEX } from '../../../../shared/team'

interface Props {
  text: string
  className?: string
}

export default function MentionText({ text, className }: Props) {
  MENTION_REGEX.lastIndex = 0
  const parts: Array<{ text: string; mention: boolean }> = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), mention: false })
    parts.push({ text: match[0], mention: true })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false })

  if (parts.length === 0 || (parts.length === 1 && !parts[0].mention)) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.mention ? (
          <span
            key={i}
            className="font-medium rounded px-0.5"
            style={{ color: '#c45d2e', backgroundColor: '#c45d2e15' }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  )
}
