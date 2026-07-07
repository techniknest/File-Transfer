'use client';

import { FileText, FileImage, FileVideo, FileAudio, FileArchive, FileCode, File, Settings } from 'lucide-react';

export default function FileIcon({ fileName }) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  
  const iconMap = {
    pdf: <FileText size={24} />, doc: <FileText size={24} />, docx: <FileText size={24} />, xls: <FileText size={24} />, xlsx: <FileText size={24} />,
    ppt: <FileText size={24} />, pptx: <FileText size={24} />, jpg: <FileImage size={24} />, jpeg: <FileImage size={24} />, png: <FileImage size={24} />,
    gif: <FileImage size={24} />, mp4: <FileVideo size={24} />, mp3: <FileAudio size={24} />, zip: <FileArchive size={24} />, rar: <FileArchive size={24} />,
    exe: <Settings size={24} />, dmg: <Settings size={24} />, txt: <FileText size={24} />, js: <FileCode size={24} />, py: <FileCode size={24} />,
    html: <FileCode size={24} />, css: <FileCode size={24} />, json: <FileCode size={24} />,
  };
  return <div className="text-gray-400">{iconMap[ext] || <File size={24} />}</div>;
}
