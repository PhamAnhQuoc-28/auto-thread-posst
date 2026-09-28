import { useState } from 'react';
import EmojiPicker, { EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import vietnameseEmoji from 'emoji-picker-react/dist/data/emojis-vi';

type Props = {
  onEmojiClick: (emoji: EmojiClickData) => void;
  onClose: () => void;
};

export default function EmojiPickerPanel({ onEmojiClick, onClose }: Props) {
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  return <>
    <div className="emoji-picker-header">
      <div><strong>Thư viện emoji</strong><small>Tìm theo tên hoặc chọn một nhóm emoji</small></div>
      <button type="button" onClick={onClose} aria-label="Đóng bảng emoji">×</button>
    </div>
    <div className="emoji-picker-language" role="group" aria-label="Ngôn ngữ tìm emoji">
      <button type="button" className={language === 'vi' ? 'selected' : ''} aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>Tiếng Việt</button>
      <button type="button" className={language === 'en' ? 'selected' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
    </div>
    <EmojiPicker key={language} emojiData={language === 'vi' ? vietnameseEmoji : undefined}
      onEmojiClick={onEmojiClick} emojiStyle={EmojiStyle.NATIVE} emojiVersion="12.1" lazyLoadEmojis
      width="100%" height="min(500px, 68vh)" autoFocusSearch
      searchPlaceholder={language === 'vi' ? 'Tìm emoji: cười, tim, hoa...' : 'Search emoji...'}
      previewConfig={{ showPreview: false }} />
  </>;
}
