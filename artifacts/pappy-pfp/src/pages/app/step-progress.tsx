import { useEffect, useRef } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetSessionStatus, useApplyProfilePicture } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "react-day-picker";

const STEPS = [
  { id: 1, label: "Initializing" },
  { id: 2, label: "Connecting to phone" },
  { id: 3, label: "Pairing session" },
  { id: 4, label: "Uploading image" },
  { id: 5, label: "Applying profile picture" },
  { id: 6, label: "Cleaning up" }
];

export default function StepProgress() {
  const { sessionId, setStep } = useWizard();
  const { toast } = useToast();
  const applyPictureMutation = useApplyProfilePicture();
  const applyInitiatedRef = useRef(false);

  const { data: statusInfo } = useGetSessionStatus(sessionId || "", { 
    query: { 
      refetchInterval: (data) => (data?.isComplete || data?.isFailed) ? false : 1000,
      enabled: !!sessionId
    } 
  });

  useEffect(() => {
    // If we just entered this step and session is paired, kick off the apply mutation
    if (statusInfo?.status === 'paired' && !applyInitiatedRef.current && sessionId) {
      applyInitiatedRef.current = true;
      applyPictureMutation.mutate({ params: { sessionId } }, {
        onError: (err: any) => {
          toast({ 
            title: "Update Failed", 
            description: err.response?.data?.error || "Failed to apply picture.", 
            variant: "destructive" 
          });
        }
      });
    }

    if (statusInfo?.isComplete && statusInfo?.status === 'completed') {
      setTimeout(() => setStep(7), 1500);
    }
  }, [statusInfo, applyPictureMutation, sessionId, toast, setStep]);

  if (!sessionId || !statusInfo) {
    return (
      <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
        <CardContent className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const currentStepNum = statusInfo.step;
  const isFailed = statusInfo.isFailed;

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
        <motion.div 
          className={`h-full ${isFailed ? 'bg-destructive' : 'bg-primary glow-cyan'}`}
          initial={{ width: 0 }}
          animate={{ width: `${statusInfo.progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <CardHeader className="text-center pt-10">
        <CardTitle className="text-3xl font-display">
          {isFailed ? "Update Failed" : "Updating Profile"}
        </CardTitle>
        <p className={`text-lg mt-2 ${isFailed ? 'text-destructive' : 'text-primary'}`}>
          {statusInfo.message}
        </p>
      </CardHeader>

      <CardContent className="py-8 px-12">
        <div className="space-y-6">
          {STEPS.map((step) => {
            const isPast = currentStepNum > step.id;
            const isCurrent = currentStepNum === step.id;
            const isFuture = currentStepNum < step.id;

            return (
              <div key={step.id} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                  ${isPast ? 'bg-primary/20 text-primary' : 
                    isCurrent && !isFailed ? 'bg-primary text-primary-foreground glow-cyan' : 
                    isCurrent && isFailed ? 'bg-destructive text-destructive-foreground' :
                    'bg-white/5 text-white/20'}`}
                >
                  {isPast ? <CheckCircle2 className="w-5 h-5" /> : 
                   isCurrent && isFailed ? <XCircle className="w-5 h-5" /> :
                   isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                   <span className="text-xs font-bold">{step.id}</span>}
                </div>
                
                <div className={`font-medium text-lg transition-colors
                  ${isPast ? 'text-white/60' : 
                    isCurrent && !isFailed ? 'text-white text-glow-cyan' : 
                    isCurrent && isFailed ? 'text-destructive' :
                    'text-white/20'}`}
                >
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>

        {isFailed && (
          <div className="mt-10 text-center">
            <Button variant="outline" onClick={() => setStep(1)}>
              Start Over
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
