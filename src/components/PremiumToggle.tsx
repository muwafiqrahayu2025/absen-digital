import React from 'react';

interface PremiumToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelBefore?: string;
  labelAfter?: string;
}

export function PremiumToggle({
  id,
  checked,
  onChange,
  labelBefore = "Off",
  labelAfter = "On"
}: PremiumToggleProps) {
  return (
    <div className="premium-toggle-container flex flex-col items-center">
      <style>{`
        /* Kontainer Utama */
        .premium-toggle-container .label-text {
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 2px;
            margin-bottom: 15px;
            text-transform: uppercase;
            opacity: 0.8;
            transition: opacity 0.3s ease;
        }

        /* Menyembunyikan Checkbox Asli */
        .premium-toggle-container .switch-input {
            display: none;
        }

        /* Jalur Tombol (Track/Slot) */
        .premium-toggle-container .switch-label {
            display: inline-block;
            width: 80px;
            height: 40px;
            background: linear-gradient(180deg, #151515, #080808);
            border-radius: 50px;
            position: relative;
            cursor: pointer;
            border: 2px solid #222;
            /* Efek kedalaman 3D ke dalam (inset shadow) */
            box-shadow: 
                inset 0 3px 6px rgba(0, 0, 0, 0.8),
                inset 0 -2px 3px rgba(255, 255, 255, 0.05),
                0 1px 1px rgba(255, 255, 255, 0.1);
            transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        }

        /* Efek Pendaran Oranye di dalam Jalur (Glow) */
        .premium-toggle-container .switch-label::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 50px;
            background: radial-gradient(circle at 35% 50%, #ff5500 0%, #cc3300 40%, transparent 70%);
            opacity: 0; /* Tersembunyi saat mati (OFF) */
            transition: opacity 0.4s ease;
            mix-blend-mode: screen;
        }

        /* Kepala Tombol Geser (Handle/Knob) */
        .premium-toggle-container .switch-handle {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #666666 0%, #333333 50%, #1a1a1a 100%);
            border-radius: 50%;
            position: absolute;
            top: 2px;
            left: 2px;
            /* Efek timbul 3D yang kuat */
            box-shadow: 
                inset 0 1px 2px rgba(255, 255, 255, 0.4),
                inset 0 -2px 3px rgba(0, 0, 0, 0.6),
                0 2px 4px rgba(0, 0, 0, 0.7),
                0 5px 10px rgba(0, 0, 0, 0.4);
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), background 0.4s ease;
        }

        /* Cekungan Jari di Tengah Tombol */
        .premium-toggle-container .switch-handle::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #222 0%, #444 100%);
            border-radius: 50%;
            box-shadow: 
                inset 0 1px 3px rgba(0, 0, 0, 0.8),
                0 1px 1px rgba(255, 255, 255, 0.1);
        }

        /* ======================================================= */
        /* LOGIKAL KONDISI AKTIF (Ketiika di-klik / Tercentang)   */
        /* ======================================================= */

        .premium-toggle-container .switch-input:checked ~ .label-text {
            opacity: 1;
        }

        .premium-toggle-container .switch-input:checked + .switch-label::before {
            opacity: 1;
        }

        .premium-toggle-container .switch-input:checked + .switch-label {
            border-color: #ff5500;
            box-shadow: 
                inset 0 3px 6px rgba(0, 0, 0, 0.8),
                0 0 10px rgba(255, 68, 0, 0.4);
        }

        .premium-toggle-container .switch-input:checked + .switch-label .switch-handle {
            transform: translateX(40px);
            background: linear-gradient(135deg, #888888 0%, #444444 50%, #2a2a2a 100%);
            box-shadow: 
                inset 0 1px 2px rgba(255, 255, 255, 0.4),
                inset 0 -2px 3px rgba(0, 0, 0, 0.6),
                -3px 0 8px rgba(255, 85, 0, 0.6),
                0 2px 4px rgba(0, 0, 0, 0.7);
        }
      `}</style>
      
      <input 
        type="checkbox" 
        id={id} 
        className="switch-input" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="switch-label">
        <span className="switch-handle"></span>
      </label>
      {(labelBefore || labelAfter) && (
        <div className="label-text mt-2 font-mono text-xs text-gray-500">
          {checked ? labelAfter : labelBefore}
        </div>
      )}
    </div>
  );
}
