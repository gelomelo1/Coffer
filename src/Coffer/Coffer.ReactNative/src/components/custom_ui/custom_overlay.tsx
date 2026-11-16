import React from "react";
import SheetModal from "./sheet_modal";

interface CustomOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  overlayTitle: string;
  children: React.ReactNode;
  /** Sticky action bar under the content (primary action of the sheet). */
  footerContent?: React.ReactNode;
}

/** Full-screen sheet used for every create/edit/select flow. */
function CustomOverlay({ isVisible, onClose, overlayTitle, children, footerContent }: CustomOverlayProps) {
  return (
    <SheetModal visible={isVisible} onClose={onClose} title={overlayTitle} footer={footerContent}>
      {children}
    </SheetModal>
  );
}

export default CustomOverlay;
