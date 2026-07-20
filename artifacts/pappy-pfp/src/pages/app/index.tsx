import { WizardProvider, useWizard } from "./wizard-context";
import { Navbar } from "@/components/layout/navbar";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

import StepUpload from "./step-upload";
import StepPreview from "./step-preview";
import StepNumber from "./step-number";
import StepMethod from "./step-method";
import StepPairing from "./step-pairing";
import StepProgress from "./step-progress";
import StepSuccess from "./step-success";

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Preview" },
  { id: 3, label: "Number" },
  { id: 4, label: "Method" },
  { id: 5, label: "Pairing" },
  { id: 6, label: "Update" }
];

function WizardHeader() {
  const { currentStep } = useWizard();
  
  if (currentStep === 7) return null; // Hide header on success screen

  return (
    <div className="w-full max-w-4xl mx-auto mb-12 hidden md:block">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
        <div 
          className="absolute left-0 top-1/2 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500 ease-in-out glow-cyan" 
          style={{ width: `${Math.min(100, ((currentStep - 1) / (STEPS.length - 1)) * 100)}%` }} 
        />
        
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isPast = currentStep > step.id;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${isActive ? 'bg-primary text-primary-foreground glow-cyan scale-110' : 
                  isPast ? 'bg-primary/20 text-primary border border-primary/50' : 
                  'bg-card border border-white/10 text-white/40'}`}
              >
                {isPast ? <Check className="w-5 h-5" /> : step.id}
              </div>
              <span className={`text-xs font-medium tracking-wide uppercase transition-colors
                ${isActive ? 'text-primary text-glow-cyan' : isPast ? 'text-white/70' : 'text-white/30'}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardContent() {
  const { currentStep } = useWizard();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && <StepUpload />}
          {currentStep === 2 && <StepPreview />}
          {currentStep === 3 && <StepNumber />}
          {currentStep === 4 && <StepMethod />}
          {currentStep === 5 && <StepPairing />}
          {currentStep === 6 && <StepProgress />}
          {currentStep === 7 && <StepSuccess />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function AppWizard() {
  return (
    <WizardProvider>
      <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
        <BackgroundOrbs />
        <Navbar />
        
        <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-12 px-4">
          <WizardHeader />
          <WizardContent />
        </main>
      </div>
    </WizardProvider>
  );
}
