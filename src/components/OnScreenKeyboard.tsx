import { useState, useEffect, useRef, useCallback } from 'react';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';

// Inmatningsfält, textrutor och redigerbara rutor (Loggens texteditor är contentEditable)
type FocusableInput = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const isEditable = (el: Element): boolean => (el as HTMLElement).isContentEditable === true;

const TYPABLE_INPUT_TYPES = new Set([
  'text',
  'email',
  'password',
  'number',
  'tel',
  'search',
  'url',
  ''
]);

const isTypable = (el: Element | null): el is FocusableInput => {
  if (!el) return false;
  if (isEditable(el)) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type ?? '';
  return TYPABLE_INPUT_TYPES.has(type);
};

/**
 * Insert text at cursor like the user typed it. document.execCommand goes
 * through the browser's native input pipeline, which triggers all the right
 * events for React's controlled inputs to update state. This avoids all
 * the value-tracker / native-setter games.
 */
const insertText = (el: FocusableInput, text: string) => {
  el.focus();
  if (isEditable(el)) {
    document.execCommand('insertText', false, text);
    return;
  }
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  if (document.execCommand) {
    document.execCommand('insertText', false, text);
  } else {
    // Fallback for browsers that don't support execCommand
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const newValue = el.value.slice(0, start) + text + el.value.slice(end);
    const setter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.setSelectionRange(start + text.length, start + text.length);
  }
};

/**
 * Delete the character before the cursor (or the selection if any).
 */
const deleteBackward = (el: FocusableInput) => {
  el.focus();
  if (isEditable(el)) {
    document.execCommand('delete');
    return;
  }
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) {
    if (start === 0) return;
    el.setSelectionRange(start - 1, start);
  }
  if (document.execCommand) {
    document.execCommand('delete');
  } else {
    const newValue = el.value.slice(0, el.selectionStart ?? 0) + el.value.slice(el.selectionEnd ?? 0);
    const setter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(el, newValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
};

/**
 * Should the OSK render at all? Yes only when the device is touch-only (kiosk):
 *   pointer: coarse (finger) + hover: none (no mouse pointer hover)
 * URL overrides for debugging: ?osk=force (always show), ?osk=off (always hide).
 * Read once at module load — kiosk and desktop don't morph mid-session.
 */
const shouldEnableOsk = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const flag = params.get('osk');
  if (flag === 'force') return true;
  if (flag === 'off') return false;
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
};

/**
 * Touchscreen on-screen keyboard. Auto-shows when a typable input is focused,
 * hides when focus moves elsewhere. Bypasses OS-level OSK quirks on Linux/Wayland.
 *
 * Only mounts on touch-only devices (the kiosk). On a regular PC with a real
 * keyboard, returns null up front so no listeners or DOM are added.
 */
const OnScreenKeyboard = () => {
  const enabled = shouldEnableOsk();
  const [visible, setVisible] = useState(false);
  const [shielding, setShielding] = useState(false);
  const [layoutName, setLayoutName] = useState<'default' | 'shift' | 'numbers'>('default');
  const focusedRef = useRef<FocusableInput | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Hide keyboard + activate a transparent click-shield over the whole viewport
   * for 300ms. This absorbs any rogue click/touch events that get synthesized
   * AFTER the keyboard's pointer-events is set to none — typically what was
   * closing the modal underneath on touchscreens.
   */
  const hideKeyboard = () => {
    setVisible(false);
    setShielding(true);
    setTimeout(() => setShielding(false), 300);
  };

  useEffect(() => {
    // Skip wiring up listeners entirely on non-touch devices.
    if (!enabled) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (isTypable(target)) {
        focusedRef.current = target;
        setVisible(true);
      }
    };

    const handleFocusOut = () => {
      // Wait a tick — focus might be moving to keyboard buttons (which we want to keep open)
      setTimeout(() => {
        const active = document.activeElement;
        if (isTypable(active)) {
          focusedRef.current = active;
          setVisible(true);
          return;
        }
        if (containerRef.current && active && containerRef.current.contains(active)) {
          return;
        }
        setVisible(false);
        focusedRef.current = null;
        setLayoutName('default');
      }, 50);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [enabled]);

  const onKeyPress = useCallback(
    (button: string) => {
      const el = focusedRef.current;
      if (!el) return;

      switch (button) {
        case '{bksp}': {
          deleteBackward(el);
          break;
        }
        case '{enter}': {
          hideKeyboard();
          break;
        }
        case '{newline}': {
          if (isEditable(el)) document.execCommand('insertParagraph');
          else if (el.tagName === 'TEXTAREA') insertText(el, '\n');
          else hideKeyboard();
          break;
        }
        case '{space}':
          insertText(el, ' ');
          break;
        case '{shift}':
          setLayoutName((prev) => (prev === 'default' ? 'shift' : 'default'));
          break;
        case '{numbers}':
          setLayoutName((prev) => (prev === 'numbers' ? 'default' : 'numbers'));
          break;
        case '{abc}':
          setLayoutName('default');
          break;
        case '{close}':
          hideKeyboard();
          break;
        case '{tab}':
          insertText(el, '\t');
          break;
        default:
          insertText(el, button);
          if (layoutName === 'shift') setLayoutName('default');
          break;
      }
    },
    [layoutName]
  );

  const layout = {
    default: [
      '1 2 3 4 5 6 7 8 9 0 {bksp}',
      'q w e r t y u i o p å',
      'a s d f g h j k l ö ä',
      '{shift} z x c v b n m , . -',
      '{numbers} {space} {newline} {enter} {close}'
    ],
    shift: [
      '! " # ¤ % & / ( ) = {bksp}',
      'Q W E R T Y U I O P Å',
      'A S D F G H J K L Ö Ä',
      '{shift} Z X C V B N M ; : _',
      '{numbers} {space} {newline} {enter} {close}'
    ],
    numbers: [
      '1 2 3 {bksp}',
      '4 5 6 -',
      '7 8 9 +',
      ', 0 . :',
      '{abc} {space} {newline} {enter} {close}'
    ]
  };

  const display = {
    '{bksp}': '⌫',
    '{enter}': 'Klar',
    '{newline}': '↵',
    '{shift}': '⇧',
    '{space}': '␣',
    '{numbers}': '123',
    '{abc}': 'ABC',
    '{close}': '✕',
    '{tab}': '⇥'
  };

  const stopAndConsume = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Bail out on PCs with real keyboards. Hooks above ran (Rules of Hooks),
  // but we render nothing.
  if (!enabled) return null;

  return (
    <>
      {/* Click-shield: absorbs any rogue click/touch events for 300ms after
          keyboard hides. Stops the synthesized click from touch events landing
          on modal backdrop / X button after pointer-events get set to none. */}
      {shielding && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'transparent',
            pointerEvents: 'auto'
          }}
          onClick={stopAndConsume}
          onMouseDown={stopAndConsume}
          onMouseUp={stopAndConsume}
          onTouchStart={stopAndConsume}
          onTouchEnd={stopAndConsume}
        />
      )}
    <div
      ref={containerRef}
      data-osk
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(680px, calc(100vw - 32px))',
        zIndex: 9999,
        background: '#FFFFFF',
        border: '1px solid #E6EAF0',
        borderRadius: '16px',
        boxShadow: '0 12px 28px rgba(13, 43, 94, 0.18), 0 4px 10px rgba(13, 43, 94, 0.08)',
        padding: '10px 12px max(12px, env(safe-area-inset-bottom))',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 150ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Keyboard
        layoutName={layoutName}
        layout={layout}
        display={display}
        onKeyPress={onKeyPress}
        physicalKeyboardHighlight={false}
        preventMouseDownDefault={true}
        buttonTheme={[
          {
            class: 'hg-button-special',
            buttons: '{shift} {bksp} {enter} {newline} {numbers} {abc} {close} {space}'
          }
        ]}
        theme="hg-theme-default hg-layout-default loggen-osk"
      />
      <style>{`
        .loggen-osk .hg-button {
          height: 42px;
          font-size: 15px;
          font-weight: 500;
          background: #FFFFFF;
          color: #0D2B5E;
          border: 1px solid #E6EAF0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(13, 43, 94, 0.04);
        }
        .loggen-osk .hg-button.hg-button-special {
          background: #EEF1F5;
          color: #5F6B7C;
          font-size: 14px;
        }
        .loggen-osk .hg-button:active,
        .loggen-osk .hg-button.hg-activeButton {
          background: #0ea5e9;
          color: #FFFFFF;
          border-color: #0ea5e9;
        }
        .loggen-osk .hg-row {
          margin-bottom: 5px;
        }
        .loggen-osk .hg-row:last-child {
          margin-bottom: 0;
        }
        .loggen-osk .hg-button[data-skbtn="{space}"] {
          flex-grow: 4;
        }
      `}</style>
    </div>
    </>
  );
};

export default OnScreenKeyboard;
