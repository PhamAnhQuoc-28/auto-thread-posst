import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import type { EmojiClickData } from 'emoji-picker-react';
import { describeUnsupportedEmoji } from '../../src/emoji/compatibility';

const EmojiPickerPanel = lazy(() => import('./EmojiPickerPanel'));

type Props = {
  value: string;
  onChange: (text: string) => void;
};

type Editor = NonNullable<ReturnType<typeof useEditor>>;

function plainText(editor: Editor): string {
  const lines: string[] = [];
  editor.state.doc.forEach(paragraph => {
    lines.push(paragraph.textBetween(0, paragraph.content.size, '\n', leaf => leaf.type.name === 'hardBreak' ? '\n' : ''));
  });
  return lines.join('\n');
}

function textDocument(text: string) {
  return {
    type: 'doc',
    content: text.split('\n').map(line => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {})
    }))
  };
}

export default function ContentEditor({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const emojiWarning = describeUnsupportedEmoji(value);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        link: false
      }),
      Placeholder.configure({ placeholder: 'Viết nội dung sẽ đăng lên Threads...' })
    ],
    content: textDocument(value),
    onUpdate: ({ editor: updated }) => onChange(plainText(updated))
  });

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [pickerOpen]);

  function insertEmoji(data: EmojiClickData) {
    editor?.chain().focus().insertContent(data.emoji).run();
  }

  return <div className="content-editor">
    <div className="editor-toolbar" role="toolbar" aria-label="Công cụ soạn nội dung" ref={toolbarRef}>
      <button type="button" aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" onClick={() => editor?.chain().focus().undo().run()}>↶</button>
      <button type="button" aria-label="Làm lại" title="Làm lại (Ctrl+Y)" onClick={() => editor?.chain().focus().redo().run()}>↷</button>
      <span className="toolbar-divider" />
      <button type="button" className="picker-trigger" aria-label="Chọn emoji" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}>☺ <span>Chọn emoji</span></button>
      {pickerOpen && <div className="emoji-picker-popover" role="dialog" aria-label="Bảng chọn emoji">
        <Suspense fallback={<div className="emoji-picker-loading">Đang tải emoji…</div>}>
          <EmojiPickerPanel onEmojiClick={insertEmoji} onClose={() => setPickerOpen(false)} />
        </Suspense>
      </div>}
      <span className="toolbar-spacer" />
      <span className="editor-count">{Array.from(value).length} ký tự</span>
    </div>
    <EditorContent editor={editor} className="editor-surface" aria-label="Nội dung bài viết" />
    {emojiWarning && <div className="emoji-compatibility-warning" role="alert">{emojiWarning}</div>}
    <div className="editor-preview">
      <strong>Xem trước nội dung sẽ đăng</strong>
      <p>{value || 'Nội dung bài viết sẽ hiện ở đây.'}</p>
    </div>
  </div>;
}
