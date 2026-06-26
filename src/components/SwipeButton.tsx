import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { EditableText } from './EditableText';

interface SwipeButtonProps {
  onSwipeComplete: () => void;
  text: string;
  isLocked?: boolean;
  lockoutTimer?: number;
  icon?: React.ReactNode;
  key?: React.Key;
}

export function SwipeButton({ onSwipeComplete, text, isLocked, lockoutTimer, icon }: SwipeButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isUnlocked || isLocked) return;
    setIsDragging(true);
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current || !knobRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const knobRect = knobRef.current.getBoundingClientRect();
    
    const maxSlide = containerRect.width - knobRect.width - 8; // 4px padding on each side
    
    let clientX = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as MouseEvent).clientX;
    }
    
    let newPosition = clientX - containerRect.left - (knobRect.width / 2);
    
    if (newPosition < 0) newPosition = 0;
    if (newPosition > maxSlide) {
      newPosition = maxSlide;
      setIsUnlocked(true);
      setIsDragging(false);
      onSwipeComplete();
      
      // Reset after a delay
      setTimeout(() => {
        setIsUnlocked(false);
        setSliderPosition(0);
      }, 3000);
    }
    
    setSliderPosition(newPosition);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!isUnlocked) {
      setSliderPosition(0);
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, isUnlocked]);

  return (
    <div className="w-full mx-auto relative group py-2">
      <div 
        ref={containerRef}
        className={`w-full relative h-16 rounded-[40px] flex items-center bg-white overflow-hidden border border-slate-200/80 shadow-[inset_0_3px_8px_rgba(0,0,0,0.05)]
          ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-all duration-300 select-none`}
      >
        {/* Glow Aura underneath knob */}
        <div 
          className="absolute h-[250%] w-[120px] top-1/2 -translate-y-1/2 rounded-full blur-[20px] opacity-40 pointer-events-none mix-blend-normal transition-transform"
          style={{ 
            transform: `translate(${sliderPosition}px, -50%)`,
            background: isUnlocked 
              ? 'radial-gradient(circle, rgba(0,255,100,0.8) 0%, rgba(0,150,255,0.4) 70%, transparent 100%)'
              : 'radial-gradient(circle, rgba(255,0,0,0.9) 0%, rgba(255,0,127,0.7) 40%, rgba(0,0,255,0.5) 80%, transparent 100%)',
            transitionDuration: isDragging ? '0ms' : '300ms'
          }}
        />

        {/* Text */}
        <div className="absolute w-full pl-16 pr-4 text-center pointer-events-none flex justify-center items-center gap-2 z-0">
          <span className={`font-black text-[13px] tracking-[0.2em] transition-opacity duration-300 
            ${isUnlocked ? 'opacity-0' : 'opacity-100 text-slate-400'} 
            ${sliderPosition > 30 ? 'opacity-0' : ''}`}
          >
            {isLocked ? `TERKUNCI (${lockoutTimer}s)` : <EditableText originalText={text} />}
          </span>
        </div>

        {/* Knob */}
        <div
          ref={knobRef}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className={`absolute left-1 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.3)] z-10 
            ${isDragging ? 'duration-0' : 'duration-300 transition-transform'}`}
          style={{ 
            transform: `translateX(${sliderPosition}px)`,
            background: 'linear-gradient(145deg, #333333, #111111)',
          }}
        >
           {/* Inner ring glow for the knob */}
           <div className="absolute inset-0 rounded-full border-2 border-transparent opacity-80" style={{
             background: isUnlocked 
               ? 'linear-gradient(145deg, #00ff64, #0096ff) border-box'
               : 'linear-gradient(145deg, #ff0000, #0000ff) border-box',
             WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
             WebkitMaskComposite: 'destination-out',
             maskComposite: 'exclude',
             transition: 'background 0.3s ease'
           }}></div>

           {isUnlocked ? <CheckCircle2 className="w-6 h-6 text-green-400 drop-shadow-[0_0_8px_rgba(0,255,100,0.8)]" /> : (icon || <div className="w-4 h-4 rounded-full bg-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"></div>)}
        </div>
      </div>
    </div>
  );
}
