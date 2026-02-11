import React, { useRef, KeyboardEvent } from 'react';
import './styles/CodeTextarea.scss';

interface CodeTextareaProps {
  value: string;
  onChange: (value: string) => void;
}

export const CodeTextarea: React.FC<CodeTextareaProps> = ({
  value,
  onChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key to insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 2 spaces at cursor position
      const newValue = value.substring(0, start) + '  ' + value.substring(end);

      onChange(newValue);

      // Move cursor after inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="code-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      spellCheck={false}
      placeholder="Write your nospace code here..."
    />
  );
};
