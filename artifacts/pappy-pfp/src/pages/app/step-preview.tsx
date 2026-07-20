import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, RotateCcw, ZoomIn } from "lucide-react";

export default function StepPreview() {
  const { uploadedImage, setStep } = useWizard();

  if (!uploadedImage) {
    setStep(1);
    return null;
  }

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Looking Good?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-10">
          {/* Circular Preview (WhatsApp Style) */}
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm font-medium text-white/50 uppercase tracking-widest">WhatsApp View</div>
            <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white/10 glow-cyan">
              <img src={uploadedImage.dataUrl} alt="Circular preview" className="w-full h-full object-cover" />
            </div>
          </div>
          
          <div className="w-px h-32 bg-white/10 hidden md:block"></div>
          
          {/* Original/Square Preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm font-medium text-white/50 uppercase tracking-widest">Original</div>
            <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-white/10">
              <img src={uploadedImage.dataUrl} alt="Square preview" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-4">
            <div className="text-sm">
              <span className="text-white/50 block mb-1">Resolution</span>
              <span className="font-mono text-white">{uploadedImage.width}x{uploadedImage.height}</span>
            </div>
            <div className="w-px bg-white/10"></div>
            <div className="text-sm">
              <span className="text-white/50 block mb-1">Size</span>
              <span className="font-mono text-white">{(uploadedImage.fileSize / 1024).toFixed(1)} KB</span>
            </div>
          </div>
          <div>
            <Badge variant={uploadedImage.qualityScore > 70 ? "success" : "warning"} className="font-mono">
              Quality: {uploadedImage.qualityScore}/100
            </Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-white/5 pt-6">
        <Button variant="ghost" onClick={() => setStep(1)} className="text-white/60">
          <ArrowLeft className="w-4 h-4 mr-2" /> Start Over
        </Button>
        <Button onClick={() => setStep(3)} className="px-8">
          Looks Good <Check className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
