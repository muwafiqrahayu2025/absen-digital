import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEditMode } from "./EditModeContext";

interface DraggableBlockProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const DraggableBlock: React.FC<DraggableBlockProps> = ({ id, children, className = "" }) => {
  const { isEditMode, layoutStore, setLayout } = useEditMode();
  
  // Default coordinate if none exists
  const initialPosition = layoutStore[id] || { x: 0, y: 0 };
  const [position, setPosition] = useState(initialPosition);

  // Sync state when layoutStore changes (e.g. initial load)
  useEffect(() => {
    if (layoutStore[id]) {
      setPosition(layoutStore[id]);
    }
  }, [layoutStore, id]);

  const handleDragEnd = (event: any, info: any) => {
    const newPos = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    };
    setPosition(newPos);
    setLayout(id, newPos);
  };

  if (!isEditMode) {
    // Render static block with offset via normal transform when not editing
    return (
      <div 
        className={className} 
        style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: 'transform 0.3s ease-out' }}
      >
        {children}
      </div>
    );
  }

  // Render draggable block when in Edit Mode
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      // Provide the starting position for the drag session
      initial={position}
      animate={position}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
      className={`relative cursor-grab border-2 border-dashed border-emerald-400 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shadow-sm ${className}`}
      style={{ touchAction: 'none' }} // Prevent scrolling while dragging on touch devices
    >
      <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md z-10 pointer-events-none">
        Drag
      </div>
      {children}
    </motion.div>
  );
};
