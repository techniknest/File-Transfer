'use client';

export default function FileIcon({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase() || '';
  const iconMap = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
    gif: '🎞️', mp4: '🎬', mp3: '🎵', zip: '🗜️', rar: '🗜️',
    exe: '⚙️', dmg: '⚙️', txt: '📃', js: '💻', py: '💻',
    html: '💻', css: '💻', json: '💻',
  };
  return <span style={{ fontSize: '1.4rem' }}>{iconMap[ext] || '📄'}</span>;
}
