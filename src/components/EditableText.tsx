import React from "react";
import { useEditMode } from "./EditModeContext";
import { useAuth } from "./AuthContext";

export const EditableText: React.FC<{
  originalText: string;
  className?: string;
  as?: React.ElementType;
}> = ({ originalText, className = "", as: Component = "span" }) => {
  const { isEditMode, getContent, setContent } = useEditMode();
  const { user } = useAuth();
  
  const label = getContent(originalText, originalText);
  // Mengizinkan edit jika isEditMode true, karena flag ini hanya bisa dinyalakan dari Dashboard Developer
  // dan nilainya dipertahankan di sessionStorage setelah logout.
  const isEditable = isEditMode;

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const newText = e.currentTarget.textContent?.trim();
    if (newText) {
      setContent(originalText, newText);
    } else {
      e.currentTarget.textContent = label;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <Component
      contentEditable={isEditable}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e: React.MouseEvent) => isEditable && e.preventDefault()}
      className={`${className} ${
        isEditable
          ? "hover:bg-white/20 px-1 -mx-1 rounded cursor-text border border-dashed border-indigo-400/50 hover:border-indigo-400 transition-all focus:outline-none focus:bg-white/50 focus:border-indigo-500 shadow-inner"
          : ""
      }`}
      title={isEditable ? "Klik untuk mengedit" : undefined}
    >
      {label}
    </Component>
  );
};
