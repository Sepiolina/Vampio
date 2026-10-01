import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserRole, UserRole } from '../context/UserRoleContext';
import { 
  Activity, 
  Code2, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  FolderSearch, 
  Sliders, 
  ShieldCheck, 
  Zap, 
  X 
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
}

export const RoleOnboardingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { role, setRole, setIsRoleModalOpen } = useUserRole();
  const [selectedRole, setSelectedRole] = useState<UserRole>(role || 'operator');

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsRoleModalOpen(false);
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, setIsRoleModalOpen]);

  if (!isOpen) return null;

  const handleConfirm = (chosenRole: UserRole) => {
    setRole(chosenRole);
    setIsRoleModalOpen(false);
    if (onClose) onClose();
  };

  const handleDismiss = () => {
    setIsRoleModalOpen(false);
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-secondary border border-border-subtle w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border-subtle bg-primary/40 flex items-start justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent border border-accent/25">
                <Zap size={12} />
                <span>Workspace Role Selection</span>
              </div>
              <h2 className="text-xl font-bold text-content">Choose Your Workspace Mode</h2>
              <p className="text-xs text-content-muted">
                Select your primary workflow. You can seamlessly switch between modes at any time from the top bar.
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  setIsRoleModalOpen(false);
                  onClose();
                }}
                className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Cards Grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Operator Mode */}
            <div
              onClick={() => setSelectedRole('operator')}
              className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                selectedRole === 'operator'
                  ? 'bg-accent/10 border-accent shadow-md shadow-accent/10'
                  : 'bg-primary/50 border-border-subtle hover:border-border-subtle/80 hover:bg-primary'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Activity size={24} />
                  </div>
                  {selectedRole === 'operator' && (
                    <span className="p-1 rounded-full bg-accent text-white">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-content">Field Operator / Technician</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 font-mono">
                    Simplified · Zero Clutter
                  </span>
                </div>

                <p className="text-xs text-content-muted leading-relaxed">
                  Tailored for production lines & field engineers. 1-click folder monitoring, file lock detection, encoding inspection (TIS-620/UTF-8), and direct export of profile bundles for DEV.
                </p>

                <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    Large Action Buttons
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    Auto Format Sniffer
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    1-Click DEV Bundle
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm('operator');
                }}
                className={`mt-4 w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                  selectedRole === 'operator'
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-secondary hover:bg-tertiary text-content border border-border-subtle'
                }`}
              >
                <span>Launch Operator Mode</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Card 2: Developer Studio */}
            <div
              onClick={() => setSelectedRole('developer')}
              className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                selectedRole === 'developer'
                  ? 'bg-accent/10 border-accent shadow-md shadow-accent/10'
                  : 'bg-primary/50 border-border-subtle hover:border-border-subtle/80 hover:bg-primary'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                    <Code2 size={24} />
                  </div>
                  {selectedRole === 'developer' && (
                    <span className="p-1 rounded-full bg-accent text-white">
                      <CheckCircle2 size={16} />
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-content">Developer Studio</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-400 font-mono">
                    Advanced · Schema Engineering
                  </span>
                </div>

                <p className="text-xs text-content-muted leading-relaxed">
                  Full synthetic generator suite. Design custom schemas, run Lua & JS scripts, configure continuous streams, benchmark throughput, and import technician profile bundles.
                </p>

                <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    Schema Designer
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    Lua & JS Engines
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-content-muted border border-border-subtle">
                    Import Workspace
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm('developer');
                }}
                className={`mt-4 w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                  selectedRole === 'developer'
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-secondary hover:bg-tertiary text-content border border-border-subtle'
                }`}
              >
                <span>Launch Developer Studio</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border-subtle bg-primary/30 flex items-center justify-between text-xs text-content-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-accent" />
              <span>Preferences saved in local storage. 100% offline & private.</span>
            </span>

            <button
              type="button"
              onClick={() => handleConfirm(selectedRole)}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition cursor-pointer"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
