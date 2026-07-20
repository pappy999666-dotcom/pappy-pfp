import { useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, ShieldCheck, Phone } from "lucide-react";

/** Strip everything except digits, return E.164 digits (no +) */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Basic E.164 length check: 7–15 digits */
function validatePhone(digits: string): string | null {
  if (digits.length < 7) return "Number too short — include your country code (e.g. +2348012345678).";
  if (digits.length > 15) return "Number too long — please check and try again.";
  return null;
}

export default function StepNumber() {
  const { setPhoneState, setStep } = useWizard();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");

  const handleContinue = () => {
    const digits = normalizePhone(raw);
    const err = validatePhone(digits);
    if (err) { setError(err); return; }
    // Store digits only, countryCode is empty since it's embedded
    setPhoneState(digits, "");
    setStep(4);
  };

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Enter Your WhatsApp Number</CardTitle>
        <CardDescription className="text-base text-white/60">
          Include your country code — spaces, dashes and + are fine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" />
          <Input
            type="tel"
            placeholder="+234 801 234 5678"
            className={`h-14 bg-black/40 border-white/10 text-xl font-mono text-white tracking-wider pl-12 pr-4
              ${error ? "border-red-500/70 focus-visible:ring-red-500/50" : ""}`}
            value={raw}
            onChange={e => { setRaw(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleContinue()}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm pl-1 flex items-center gap-2">
            <span className="text-red-400">⚠</span> {error}
          </p>
        )}

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-white/60 leading-relaxed">
            <span className="text-white font-semibold block mb-0.5">Privacy First</span>
            We connect temporarily to update your picture, then disconnect immediately. No data is stored.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-white/5 pt-6">
        <Button variant="ghost" onClick={() => setStep(2)} className="text-white/60">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue} className="px-8">
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
