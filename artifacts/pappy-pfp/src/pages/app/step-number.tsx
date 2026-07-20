import { useState } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COUNTRIES = [
  { code: "+1", name: "US / Canada", flag: "🇺🇸" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+234", name: "Nigeria", flag: "🇳🇬" },
  { code: "+254", name: "Kenya", flag: "🇰🇪" },
  { code: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+62", name: "Indonesia", flag: "🇮🇩" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+52", name: "Mexico", flag: "🇲🇽" },
];

export default function StepNumber() {
  const { phoneNumber, countryCode, setPhoneState, setStep } = useWizard();
  const [localPhone, setLocalPhone] = useState(phoneNumber);
  const [localCode, setLocalCode] = useState(countryCode);

  const isValid = localPhone.replace(/\D/g, '').length >= 7;

  const handleContinue = () => {
    if (isValid) {
      setPhoneState(localPhone.replace(/\D/g, ''), localCode);
      setStep(4);
    }
  };

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Enter WhatsApp Number</CardTitle>
        <CardDescription className="text-base">
          Which account are we updating today?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <div className="w-[140px]">
            <Select value={localCode} onValueChange={setLocalCode}>
              <SelectTrigger className="h-14 bg-black/40 border-white/10 text-white font-display">
                <SelectValue placeholder="Code" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A0E1A] border-white/10 text-white max-h-[300px]">
                {COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.code} className="hover:bg-white/5 cursor-pointer">
                    <span className="font-sans mr-2">{c.flag}</span>
                    <span className="font-mono text-white/50 w-10 inline-block">{c.code}</span>
                    <span className="truncate">{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 relative">
            <Input 
              type="tel" 
              placeholder="Phone number" 
              className="h-14 bg-black/40 border-white/10 text-xl font-mono text-white tracking-wider px-4"
              value={localPhone}
              onChange={e => setLocalPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValid && handleContinue()}
              autoFocus
            />
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-4 text-sm">
          <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
          <p className="text-white/70 leading-relaxed">
            <span className="text-white font-semibold block mb-1">Privacy First</span>
            We temporarily connect to your WhatsApp to update your picture. Your session is removed immediately after — unless you choose otherwise.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-white/5 pt-6">
        <Button variant="ghost" onClick={() => setStep(2)} className="text-white/60">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue} disabled={!isValid} className="px-8">
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
