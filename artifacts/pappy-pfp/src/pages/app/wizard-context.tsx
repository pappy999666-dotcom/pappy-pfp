import { useState, createContext, useContext } from 'react';
import type { ImageInfo } from '@workspace/api-client-react/src/generated/api.schemas';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface WizardState {
  currentStep: WizardStep;
  uploadId: string | null;
  uploadedImage: ImageInfo | null;
  phoneNumber: string;
  countryCode: string;
  sessionId: string | null;
  setStep: (step: WizardStep) => void;
  setUploadState: (id: string, img: ImageInfo) => void;
  setPhoneState: (phone: string, code: string) => void;
  setSessionId: (id: string) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardState | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<ImageInfo | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const resetWizard = () => {
    setCurrentStep(1);
    setUploadId(null);
    setUploadedImage(null);
    setPhoneNumber("");
    setSessionId(null);
  };

  return (
    <WizardContext.Provider value={{
      currentStep,
      uploadId,
      uploadedImage,
      phoneNumber,
      countryCode,
      sessionId,
      setStep: setCurrentStep,
      setUploadState: (id, img) => { setUploadId(id); setUploadedImage(img); },
      setPhoneState: (phone, code) => { setPhoneNumber(phone); setCountryCode(code); },
      setSessionId,
      resetWizard
    }}>
      {children}
    </WizardContext.Provider>
  );
}
