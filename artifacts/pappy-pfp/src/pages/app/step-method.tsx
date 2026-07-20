import { useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, QrCode, Hash, Clock, Infinity } from "lucide-react";
import { useCreateSession } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type PairingMethod = "qr" | "code";
type SessionType = "temporary" | "permanent";

export default function StepMethod() {
  const { phoneNumber, countryCode, uploadId, setSessionId, setStep } = useWizard();
  const [method, setMethod] = useState<PairingMethod>("code");
  const [sessionType, setSessionType] = useState<SessionType>("temporary");
  const { toast } = useToast();
  
  const createSessionMutation = useCreateSession();

  const handleCreateSession = async () => {
    try {
      const res = await createSessionMutation.mutateAsync({
        data: {
          phoneNumber: `${countryCode}${phoneNumber}`,
          countryCode,
          pairingMethod: method,
          sessionType,
          uploadId
        }
      });
      setSessionId(res.id);
      setStep(5);
    } catch (err: any) {
      toast({ 
        title: "Failed to create session", 
        description: err.response?.data?.error || "Please try again.", 
        variant: "destructive" 
      });
    }
  };

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connection Settings</CardTitle>
        <CardDescription>How would you like to link your account?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* Pairing Method */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-widest pl-1">Pairing Method</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMethod("code")}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center
                ${method === "code" ? 'border-primary bg-primary/10 glow-cyan scale-[1.02]' : 'border-white/10 hover:border-white/30 bg-black/40'}
              `}
            >
              <Hash className={`w-8 h-8 mb-3 ${method === "code" ? 'text-primary' : 'text-white/50'}`} />
              <div className={`font-semibold font-display mb-1 ${method === "code" ? 'text-white' : 'text-white/70'}`}>Pairing Code</div>
              <div className="text-xs text-white/40">Enter 8 digits on phone</div>
            </button>
            <button
              onClick={() => setMethod("qr")}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center
                ${method === "qr" ? 'border-primary bg-primary/10 glow-cyan scale-[1.02]' : 'border-white/10 hover:border-white/30 bg-black/40'}
              `}
            >
              <QrCode className={`w-8 h-8 mb-3 ${method === "qr" ? 'text-primary' : 'text-white/50'}`} />
              <div className={`font-semibold font-display mb-1 ${method === "qr" ? 'text-white' : 'text-white/70'}`}>QR Code</div>
              <div className="text-xs text-white/40">Scan with WhatsApp</div>
            </button>
          </div>
        </div>

        {/* Session Type */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-widest pl-1">Session Duration</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSessionType("temporary")}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                ${sessionType === "temporary" ? 'border-purple-500 bg-purple-500/10 glow-purple' : 'border-white/10 hover:border-white/30 bg-black/40'}
              `}
            >
              <Clock className={`w-6 h-6 shrink-0 ${sessionType === "temporary" ? 'text-purple-400' : 'text-white/40'}`} />
              <div>
                <div className={`font-semibold text-sm ${sessionType === "temporary" ? 'text-white' : 'text-white/70'}`}>Temporary (Recommended)</div>
                <div className="text-xs text-white/40 mt-0.5">Disconnects immediately after update</div>
              </div>
            </button>
            <button
              onClick={() => setSessionType("permanent")}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                ${sessionType === "permanent" ? 'border-purple-500 bg-purple-500/10 glow-purple' : 'border-white/10 hover:border-white/30 bg-black/40'}
              `}
            >
              <Infinity className={`w-6 h-6 shrink-0 ${sessionType === "permanent" ? 'text-purple-400' : 'text-white/40'}`} />
              <div>
                <div className={`font-semibold text-sm ${sessionType === "permanent" ? 'text-white' : 'text-white/70'}`}>Permanent</div>
                <div className="text-xs text-white/40 mt-0.5">Stay connected for future updates</div>
              </div>
            </button>
          </div>
        </div>

      </CardContent>
      <CardFooter className="flex justify-between border-t border-white/5 pt-6">
        <Button variant="ghost" onClick={() => setStep(3)} className="text-white/60">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={handleCreateSession} 
          disabled={createSessionMutation.isPending} 
          className="px-8"
        >
          {createSessionMutation.isPending ? "Connecting..." : "Connect"} 
          {!createSessionMutation.isPending && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
