import { useEffect } from "react";

interface Props {
  imageUrl: string;
  alt?: string;
  onClose: () => void;
}

export default function ImagePreviewModal({ imageUrl, alt, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <img src={imageUrl} alt={alt || "Preview"} className="image-preview-img" />
      </div>
    </div>
  );
}
