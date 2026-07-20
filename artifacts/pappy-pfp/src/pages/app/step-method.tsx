import { useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, QrCode, Hash, Clock, ExternalLink } from "lucide-react";
import { useCreateSession } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type PairingMethod = "qr" | "code";

export default function StepMethod() {
  const { phoneNumber, uploadId, setSessionId, setStep } = useWizard();
  const [method, setMethod] = useState<PairingMethod>("code");
  const [showPermanentInfo, setShowPermanentInfo] = useState(false);
  const { toast } = useToast();

  const createSessionMutation = useCreateSession();

  const handleConnect = async () => {
    try {
      const res = await createSessionMutation.mutateAsync({
        data: {
          phoneNumber,
          countryCode: "",
          pairingMethod: method,
          sessionType: "temporary",
          uploadId,
        },
      });
      setSessionId(res.id);
      setStep(5);
    } catch (err: any) {
      toast({
        title: "Connection failed",
        description: err.data?.error || err.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (showPermanentInfo) {
    return (
      <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Permanent Session</CardTitle>
          <CardDescription className="text-base text-white/60">
            Auto-change requires the Telegram bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-4">
            <p className="text-white/80 leading-relaxed text-sm">
              Permanent sessions and auto-change scheduling are managed through the Telegram bot.
              The web app is for one-time profile picture updates only.
            </p>
            <div className="space-y-2 text-sm text-white/60">
              <p className="flex items-start gap-2"><span className="text-primary">1.</span> Open the bot on Telegram</p>
              <p className="flex items-start gap-2"><span className="text-primary">2.</span> Tap <strong className="text-white">Pair WhatsApp</strong> and link your number</p>
              <p className="flex items-start gap-2"><span className="text-primary">3.</span> Use <strong className="text-white">Auto-Change PFP</strong> to set a schedule</p>
            </div>
          </div>
          <Button
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white gap-2"
            onClick={() => window.open("https://t.me/pappy_wallpaperbot", "_blank")}
          >
            <ExternalLink className="w-4 h-4" /> Open Telegram Bot
          </Button>
        </CardContent>
        <CardFooter className="border-t border-white/5 pt-6">
          <Button variant="ghost" onClick={() => setShowPermanentInfo(false)} className="text-white/60">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Choose Pairing Method</CardTitle>
        <CardDescription>How would you like to link your WhatsApp?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMethod("code")}
            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center
              ${method === "code" ? "border-primary bg-primary/10 scale-[1.02]" : "border-white/10 hover:border-white/30 bg-black/40"}`}
          >
            <Hash className={`w-8 h-8 mb-3 ${method === "code" ? "text-primary" : "text-white/50"}`} />
            <div className={`font-semibold mb-1 ${method === "code" ? "text-white" : "text-white/70"}`}>Pairing Code</div>
            <div className="text-xs text-white/40">Enter 8-digit code on phone</div>
          </button>
          <button
            onClick={() => setMethod("qr")}
            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all text-center
              ${method === "qr" ? "border-primary bg-primary/10 scale-[1.02]" : "border-white/10 hover:border-white/30 bg-black/40"}`}
          >
            <QrCode className={`w-8 h-8 mb-3 ${method === "qr" ? "text-primary" : "text-white/50"}`} />
            <div className={`font-semibold mb-1 ${method === "qr" ? "text-white" : "text-white/70"}`}>QR Code</div>
            <div className="text-xs text-white/40">Scan with WhatsApp</div>
          </button>
        </div>

        {/* Permanent session info link */}
        <button
          onClick={() => setShowPermanentInfo(true)}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
        >
          <Clock className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <div className="text-sm font-medium text-white/70">Want auto-change on a schedule?</div>
            <div className="text-xs text-white/40 mt-0.5">Use the Telegram bot for permanent sessions →</div>
          </div>
        </button>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-white/5 pt-6">
        <Button variant="ghost" onClick={() => setStep(3)} className="text-white/60">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleConnect} disabled={createSessionMutation.isPending} className="px-8">
          {createSessionMutation.isPending ? "Connecting..." : <>Connect <ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>
      </CardFooter>
    </Card>
  );
}
