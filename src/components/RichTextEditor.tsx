import { useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value
      }
    }
    isInternalChange.current = false
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      isInternalChange.current = true
      onChange(editorRef.current.innerHTML)
    }
  }

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const insertList = () => {
    execFormat('insertUnorderedList')
  }

  const insertLink = () => {
    const url = prompt('Ange länk URL:')
    if (url) {
      execFormat('createLink', url)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault()
        execFormat('bold')
      } else if (e.key === 'i') {
        e.preventDefault()
        execFormat('italic')
      } else if (e.key === 'u') {
        e.preventDefault()
        execFormat('underline')
      }
    }
  }

  return (
    <div className="rich-editor-container">
      <div className="format-toolbar">
        <button 
          type="button" 
          className="format-btn format-btn--bold"
          onClick={() => execFormat('bold')}
          title="Fet (Ctrl+B)"
        >
          B
        </button>
        <button 
          type="button" 
          className="format-btn format-btn--italic"
          onClick={() => execFormat('italic')}
          title="Kursiv (Ctrl+I)"
        >
          I
        </button>
        <button 
          type="button" 
          className="format-btn format-btn--underline"
          onClick={() => execFormat('underline')}
          title="Understruken (Ctrl+U)"
        >
          U
        </button>
        <button 
          type="button" 
          className="format-btn format-btn--list"
          onClick={insertList}
          title="Punktlista"
        >
          •
        </button>
        <button 
          type="button" 
          className="format-btn format-btn--link"
          onClick={insertLink}
          title="Länk"
        >
          🔗
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  )
}
