import { useRef, useEffect, useCallback, memo } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const RichTextEditor = memo(function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value) // Track the last value we sent to parent
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Only sync external value changes (e.g., form reset, initial load)
  useEffect(() => {
    if (editorRef.current) {
      // Only update DOM if this is a genuinely external change
      // (not a result of our own onChange call)
      if (value !== lastValueRef.current) {
        editorRef.current.innerHTML = value
        lastValueRef.current = value
      }
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    
    // Clear any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    // Debounce the state update, not the typing
    debounceTimer.current = setTimeout(() => {
      if (editorRef.current) {
        const newValue = editorRef.current.innerHTML
        lastValueRef.current = newValue // Track what we're sending
        onChange(newValue)
      }
    }, 150) // 150ms is a good balance - fast enough to feel responsive
  }, [onChange])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  // Flush pending changes on blur (so submit always has latest)
  const handleBlur = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML
      if (newValue !== lastValueRef.current) {
        lastValueRef.current = newValue
        onChange(newValue)
      }
    }
  }, [onChange])

  const execFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    // Trigger input to capture formatting change
    handleInput()
  }, [handleInput])

  const insertList = useCallback(() => {
    execFormat('insertUnorderedList')
  }, [execFormat])

  const insertLink = useCallback(() => {
    const url = prompt('Ange länk URL:')
    if (url) {
      execFormat('createLink', url)
    }
  }, [execFormat])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          execFormat('bold')
          break
        case 'i':
          e.preventDefault()
          execFormat('italic')
          break
        case 'u':
          e.preventDefault()
          execFormat('underline')
          break
      }
    }
  }, [execFormat])

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
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  )
})

export default RichTextEditor
