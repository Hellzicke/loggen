import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'

interface RichTextEditorProps {
  initialValue?: string
  placeholder?: string
}

export interface RichTextEditorRef {
  getValue: () => string
  setValue: (value: string) => void
  focus: () => void
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor({ initialValue = '', placeholder }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)

    // Set initial value on mount only
    useEffect(() => {
      if (editorRef.current && initialValue) {
        editorRef.current.innerHTML = initialValue
      }
    }, []) // Empty deps - only run on mount

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      getValue: () => editorRef.current?.innerHTML || '',
      setValue: (value: string) => {
        if (editorRef.current) {
          editorRef.current.innerHTML = value
        }
      },
      focus: () => editorRef.current?.focus()
    }), [])

    const execFormat = useCallback((command: string, value?: string) => {
      document.execCommand(command, false, value)
      editorRef.current?.focus()
    }, [])

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
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
    )
  }
)

export default RichTextEditor
