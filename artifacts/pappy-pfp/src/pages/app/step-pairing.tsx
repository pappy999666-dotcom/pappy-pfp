import { useEffect, useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, QrCode, Smartphone, SmartphoneNfc } from "lucide-react";
import { useGetSession, useGetSessionQR, useGetSessionStatus } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export default function StepPairing() {
  const { sessionId, setStep } = useWizard();
  const [localStatus, setLocalStatus] = useState<string>("pending");
  
  if (!sessionId) {
    setStep(1);
    return null;
  }

  const { data: session } = useGetSession(sessionId);
  const { data: qrData } = useGetSessionQR(sessionId, { query: { enabled: session?.pairingMethod === 'qr' && session?.status === 'awaiting_scan' } });
  
  const { data: statusInfo } = useGetSessionStatus(sessionId, { 
    query: { 
      refetchInterval: 2000,
      enabled: !!sessionId && localStatus !== 'paired' && localStatus !== 'completed' && localStatus !== 'failed'
    } 
  });

  useEffect(() => {
    if (statusInfo) {
      setLocalStatus(statusInfo.status);
      if (statusInfo.status === 'paired' || statusInfo.status === 'uploading' || statusInfo.status === 'applying' || statusInfo.status === 'completed') {
        // Move to progress step
        setTimeout(() => setStep(6), 1000);
      }
    }
  }, [statusInfo, setStep]);

  if (!session) {
    return (
      <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-white/60">Initializing connection...</p>
        </CardContent>
      </Card>
    );
  }

  const isCodeMethod = session.pairingMethod === 'code';

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl relative overflow-hidden">
      {/* Background connection animation */}
      {session.status === 'connecting' && (
         <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMjBMNDAgMjAiIHN0cm9rZT0iIzAwRDRGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSI0IDQiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')] opacity-50 animate-[slide-right_2s_linear_infinite]" />
         </div>
      )}

      <CardHeader className="text-center relative z-10">
        <CardTitle className="text-2xl">
          {session.status === 'connecting' ? 'Connecting to Network...' : 'Link Your WhatsApp'}
        </CardTitle>
        <CardDescription>
          {session.status === 'connecting' 
            ? 'Establishing secure connection to WhatsApp servers.' 
            : 'Follow the instructions below on your phone.'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-8 relative z-10 pt-4">
        
        {session.status === 'connecting' ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative w-24 h-24 flex items-center justify-center mb-6">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border-2 border-primary/50"
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute inset-[-10px] rounded-full border border-purple-500/30"
              />
              <SmartphoneNfc className="w-10 h-10 text-primary relative z-10" />
            </div>
            <p className="font-mono text-primary text-sm tracking-widest uppercase">Negotiating Handshake</p>
          </div>
        ) : (
          <>
            {isCodeMethod ? (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-black/50 border border-white/10 rounded-2xl p-8 flex flex-col items-center max-w-sm w-full glow-cyan-lg">
                  <div className="text-sm text-white/50 uppercase tracking-widest mb-4">Your Pairing Code</div>
                  {session.pairingCode ? (
                    <div className="font-mono text-5xl md:text-6xl font-bold tracking-[0.2em] text-white">
                      {session.pairingCode}
                    </div>
                  ) : (
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  )}
                </div>
                
                <div className="text-left w-full max-w-sm space-y-4">
                  <Instruction step="1" text="Open WhatsApp on your phone" />
                  <Instruction step="2" text="Tap Settings (or 3 dots) > Linked Devices" />
                  <Instruction step="3" text="Tap 'Link a Device'" />
                  <Instruction step="4" text="Tap 'Link with phone number instead'" />
                  <Instruction step="5" text="Enter the code shown above" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-white p-4 rounded-xl shadow-2xl relative glow-cyan-lg">
                  {qrData?.qrDataUrl ? (
                    <img src={qrData.qrDataUrl} alt="WhatsApp Pairing QR Code" className="w-64 h-64" />
                  ) : (
                     <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                       <Loader2 className="w-10 h-10 text-primary animate-spin" />
                     </div>
                  )}
                  <div className="absolute inset-0 bg-primary/10 border-2 border-primary/50 pointer-events-none rounded-xl"></div>
                  {/* Scanning animation effect */}
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_3px_rgba(0,212,255,0.8)] z-10"
                  />
                </div>
                
                <div className="text-left w-full max-w-sm space-y-4">
                  <Instruction step="1" text="Open WhatsApp on your phone" />
                  <Instruction step="2" text="Tap Settings (or 3 dots) > Linked Devices" />
                  <Instruction step="3" text="Tap 'Link a Device'" />
                  <Instruction step="4" text="Point your phone at this screen to capture the code" />
                </div>
              </div>
            )}
          </>
        )}

      </CardContent>
      {session.status !== 'connecting' && (
        <CardFooter className="flex justify-start border-t border-white/5 pt-6 relative z-10">
          <Button variant="ghost" onClick={() => setStep(4)} className="text-white/60">
            <ArrowLeft className="w-4 h-4 mr-2" /> Change Method
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function Instruction({ step, text }: { step: string, text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 text-white/70">
        {step}
      </div>
      <p className="text-white/80 text-sm pt-0.5 leading-tight">{text}</p>
    </div>
  );
}
