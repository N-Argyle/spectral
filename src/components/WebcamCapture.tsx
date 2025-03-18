"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Toggle } from "~/components/ui/toggle";
import { CameraIcon } from "lucide-react";

interface WebcamCaptureProps {
  onFrameCapture?: (imageData: ImageData) => void;
  onReferenceCaptured?: (imageData: ImageData) => void;
  onSampleCaptured?: (imageData: ImageData) => void;
}

export default function WebcamCapture({
  onFrameCapture,
  onReferenceCaptured,
  onSampleCaptured
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isMirrored, setIsMirrored] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectionRect, setSelectionRect] = useState({ x: 0, y: 0, width: 225, height: 85 });
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // Load available webcams
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission first to ensure we get accurate device list
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0 && !selectedDeviceId) {
          const firstDevice = videoDevices[0];
          setSelectedDeviceId(firstDevice?.deviceId ?? "");
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    }
    
    void getDevices();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedDeviceId, stream]);

  // Set up video element event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleCanPlay = () => {
      if (video.paused) {
        // Use a promise and catch errors
        void video.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
      setIsReady(true);
    };
    
    video.addEventListener('canplay', handleCanPlay);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Connect to selected webcam
  useEffect(() => {
    if (!selectedDeviceId || !videoRef.current) return;
    
    async function startCamera() {
      try {
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Reset ready state
        setIsReady(false);
        
        // Get new stream
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        setStream(newStream);
        
        if (videoRef.current) {
          // Set muted before setting srcObject to avoid audio issues
          videoRef.current.muted = true;
          videoRef.current.srcObject = newStream;
          // The play will be handled by the canplay event listener
        }
      } catch (error) {
        console.error("Error starting camera:", error);
      }
    }
    
    void startCamera();
  }, [selectedDeviceId]);

  // Process frames from the video - use useCallback to avoid recreating this function
  const processVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) return;
    
    // Set initial canvas dimensions if needed
    if (canvas.width === 0 && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    // Only update canvas dimensions if video size has changed
    if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
      // Draw the video frame on the canvas
      if (isMirrored) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      // Draw the selection rectangle
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
      
      // Add label for selection area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        selectionRect.x, 
        selectionRect.y + selectionRect.height, 
        selectionRect.width, 
        24
      );
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `Crop: ${selectionRect.width}x${selectionRect.height}px`, 
        selectionRect.x + 5, 
        selectionRect.y + selectionRect.height + 16
      );
      
      // Extract the selected region
      try {
        const imageData = ctx.getImageData(
          selectionRect.x, 
          selectionRect.y, 
          selectionRect.width, 
          selectionRect.height
        );
        
        // Pass the imageData to parent component if callback exists
        if (onFrameCapture) {
          onFrameCapture(imageData);
        }
      } catch (e) {
        console.error("Error extracting image data:", e);
      }
    }
    
    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  }, [isReady, isMirrored, selectionRect, onFrameCapture]);

  // Start and stop the animation loop when dependencies change
  useEffect(() => {
    if (!isReady) return;
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isReady, processVideoFrame]);

  // Handle canvas mouse events for selection rectangle
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
    
    // Check if we're on the selection rectangle
    if (
      x >= selectionRect.x && 
      x <= selectionRect.x + selectionRect.width &&
      y >= selectionRect.y && 
      y <= selectionRect.y + selectionRect.height
    ) {
      setDragStart({ x, y });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
    
    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;
    
    setSelectionRect(prev => ({
      ...prev,
      x: Math.max(0, Math.min(canvasRef.current!.width - prev.width, prev.x + deltaX)),
      y: Math.max(0, Math.min(canvasRef.current!.height - prev.height, prev.y + deltaY))
    }));
    
    setDragStart({ x, y });
  };
  
  const handleMouseUp = () => {
    setDragStart(null);
  };

  const captureReference = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    try {
      const imageData = ctx.getImageData(
        selectionRect.x, 
        selectionRect.y, 
        selectionRect.width, 
        selectionRect.height
      );
      
      if (onReferenceCaptured) {
        onReferenceCaptured(imageData);
      }
    } catch (e) {
      console.error("Error capturing reference:", e);
    }
  };
  
  const captureSample = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    try {
      const imageData = ctx.getImageData(
        selectionRect.x, 
        selectionRect.y, 
        selectionRect.width, 
        selectionRect.height
      );
      
      if (onSampleCaptured) {
        onSampleCaptured(imageData);
      }
    } catch (e) {
      console.error("Error capturing sample:", e);
    }
  };

  return (
    <Card className="w-full border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <CameraIcon className="h-5 w-5" />
          Webcam Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="bg-black w-full aspect-video flex items-center justify-center overflow-hidden relative">
          <video 
            ref={videoRef} 
            className="absolute w-full h-full object-contain opacity-0"
            playsInline 
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-contain" 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col md:flex-row items-stretch gap-2 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm whitespace-nowrap">Camera:</span>
          <Select 
            value={selectedDeviceId} 
            onValueChange={setSelectedDeviceId}
          >
            <SelectTrigger className="w-full truncate">
              <SelectValue placeholder="Select camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map(device => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${devices.indexOf(device) + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <Toggle 
            aria-label="Toggle mirror mode" 
            pressed={isMirrored} 
            onPressedChange={setIsMirrored}
          >
            Mirror
          </Toggle>
          <Button onClick={captureReference} className="whitespace-nowrap" variant="secondary">
            Capture Reference
          </Button>
          <Button onClick={captureSample} className="whitespace-nowrap">
            Capture Sample
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 