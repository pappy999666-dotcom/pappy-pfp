import { useState, useRef } from "react";
import { useWizard } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Image as ImageIcon, Loader2 } from "lucide-react";
import { useUploadImage } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function StepUpload() {
  const { setUploadState, setStep } = useWizard();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const uploadMutation = useUploadImage();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, WEBP).", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await uploadMutation.mutateAsync({ data: formData as any });
      setUploadState(response.id, response);
      setStep(2);
    } catch (err: any) {
      toast({ 
        title: "Upload failed", 
        description: err.response?.data?.error || "Failed to upload image. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  };

  return (
    <Card className="border-primary/20 bg-[#0A0E1A]/80 backdrop-blur-xl relative overflow-hidden" onPaste={onPaste}>
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-3xl">Upload Your Photo</CardTitle>
        <CardDescription className="text-base text-white/60">
          Drag and drop, paste from clipboard, or click to browse.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div 
          className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-300 group
            ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-white/10 hover:border-primary/50 hover:bg-white/5'}
            ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          `}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/png, image/jpeg, image/webp" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          
          <div className="w-20 h-20 mb-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:glow-cyan">
            {uploadMutation.isPending ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <UploadCloud className="w-10 h-10 text-primary" />
            )}
          </div>
          
          <h3 className="text-xl font-display font-semibold mb-2 text-white">
            {uploadMutation.isPending ? "Uploading..." : "Click or drag image here"}
          </h3>
          <p className="text-sm text-white/40 mb-6 text-center max-w-[250px]">
            PNG, JPG or WEBP. Max 10MB.<br/>Square images work best.
          </p>
          
          <Button type="button" variant={isDragging ? "default" : "secondary"} className="pointer-events-none">
            {uploadMutation.isPending ? "Uploading..." : "Browse Files"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
