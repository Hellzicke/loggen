import { ReactNode } from 'react'

export function formatText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  // Pattern: **bold**, *italic*, __underline__
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }

    if (match[1]) {
      // Bold: **text**
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      // Italic: *text*
      parts.push(<em key={key++}>{match[4]}</em>)
    } else if (match[5]) {
      // Underline: __text__
      parts.push(<u key={key++}>{match[6]}</u>)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  // If no formatting found, return original text
  if (parts.length === 0) {
    return [text]
  }

  return parts
}

