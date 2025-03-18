"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Toggle } from "~/components/ui/toggle";
import { CameraIcon } from "lucide-react";
import { checkBrowserCapabilities, applyAdvancedCameraSettings } from "~/lib/camera-utils";

interface WebcamCaptureProps {
  onFrameCapture?: (imageData: ImageData, blackoutCalibrationData: ImageData | null) => void;
  onReferenceCaptured?: (imageData: ImageData) => void;
  onSampleCaptured?: (imageData: ImageData) => void;
  onBlackoutCalibrated?: (imageData: ImageData) => void;
}

export default function WebcamCapture({
  onFrameCapture,
  onReferenceCaptured,
  onSampleCaptured,
  onBlackoutCalibrated
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isMirrored, setIsMirrored] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectionRect, setSelectionRect] = useState({ x: 0, y: 0, width: 225, height: 85 });
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStartRect, setDragStartRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const [focusMode, setFocusMode] = useState<'auto' | 'manual'>('auto');
  
  // Black-out calibration state
  const [blackoutCalibrationData, setBlackoutCalibrationData] = useState<ImageData | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const blackoutCalibrationRef = useRef<ImageData | null>(null);
  
  // Update ref when blackoutCalibrationData changes
  useEffect(() => {
    // Update the ref whenever blackoutCalibrationData changes
    if (blackoutCalibrationData) {
      console.log("WebcamCapture: blackoutCalibrationData changed, updating ref");
      blackoutCalibrationRef.current = blackoutCalibrationData;
    }
  }, [blackoutCalibrationData]);

  // Function to check if the browser supports focus mode
  const checkFocusSupport = useCallback(() => {
    const capabilities = checkBrowserCapabilities();
    return capabilities.focusModeSupported;
  }, []);

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

  // Add new effect to resize the canvas when the video metadata is loaded
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const handleResize = () => {
      // Get the actual video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      if (videoWidth && videoHeight) {
        // Set canvas dimensions to match video dimensions
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        console.log(`Canvas resized to match video: ${videoWidth}x${videoHeight}`);
      }
    };
    
    // Set initial dimensions when video metadata loads
    const handleLoadedMetadata = () => {
      handleResize();
    };
    
    // Also handle window resize events to maintain proper scaling
    window.addEventListener('resize', handleResize);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Call immediately in case the video is already loaded
    if (video.videoWidth) {
      handleResize();
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef.current, canvasRef.current]);

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
        
        // Get new stream with basic constraints
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        // Apply advanced camera settings if needed
        if (focusMode === 'manual') {
          const videoTrack = newStream.getVideoTracks()[0];
          if (videoTrack) {
            await applyAdvancedCameraSettings(videoTrack, {
              disableAutofocus: true
            });
          }
        }
        
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

  // Helper function to draw the selection rectangle
  const drawSelectionRect = (ctx: CanvasRenderingContext2D) => {
    const { x, y, width, height } = selectionRect;
    
    // Draw the main selection rectangle
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Draw the handles for resizing
    const handleSize = 8;
    ctx.fillStyle = '#00ff00';
    
    // Corner handles
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize); // top-left
    ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize); // top-right
    ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize); // bottom-left
    ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize); // bottom-right
  };

  // Process frames from the video - use useCallback to avoid recreating this function
  const processVideoFrame = useCallback(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;
    
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw the mirrored or non-mirrored video based on the setting
      if (isMirrored) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      
      // Draw the selection rectangle
      if (selectionRect) {
        drawSelectionRect(ctx);
      }

      // Extract the selected region's image data
      if (selectionRect.width > 0 && selectionRect.height > 0) {
        try {
          const imageData = ctx.getImageData(
            selectionRect.x, 
            selectionRect.y, 
            selectionRect.width, 
            selectionRect.height
          );
          
          // Check if we have a blackout calibration available
          const blackoutData = blackoutCalibrationRef.current;
          
          // Debug log the blackout calibration status
          if (onFrameCapture) {
            console.log(`processVideoFrame: Frame data ${imageData.width}x${imageData.height}` + 
                        (blackoutData ? ` with blackout data ${blackoutData.width}x${blackoutData.height}` 
                                      : ` WITHOUT blackout data`));
            
            onFrameCapture(imageData, blackoutCalibrationRef.current);
          }
        } catch (e) {
          console.error("Error extracting image data:", e);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(processVideoFrame);
    } catch (error) {
      console.error("Error processing video frame:", error);
    }
  }, [drawSelectionRect, isMirrored, isReady, onFrameCapture, selectionRect]);

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

  // Helper function to convert screen coordinates to canvas coordinates
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Handle canvas mouse events for selection rectangle
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    const handleSize = 20; // Increased handle size for easier grabbing
    
    // Check if clicking on the top drag handle
    if (x >= selectionRect.x && 
        x <= selectionRect.x + selectionRect.width && 
        y >= selectionRect.y - handleSize && 
        y <= selectionRect.y) {
      setDragMode('move');
      setDragStart({ x, y });
      setDragStartRect({ ...selectionRect });
      e.preventDefault();
      return;
    }
    
    // Check if we're on a resize handle
    const onNW = Math.abs(x - selectionRect.x) <= handleSize && Math.abs(y - selectionRect.y) <= handleSize;
    const onNE = Math.abs(x - (selectionRect.x + selectionRect.width)) <= handleSize && Math.abs(y - selectionRect.y) <= handleSize;
    const onSW = Math.abs(x - selectionRect.x) <= handleSize && Math.abs(y - (selectionRect.y + selectionRect.height)) <= handleSize;
    const onSE = Math.abs(x - (selectionRect.x + selectionRect.width)) <= handleSize && Math.abs(y - (selectionRect.y + selectionRect.height)) <= handleSize;
    
    if (onNW) {
      setDragMode('resize-nw');
    } else if (onNE) {
      setDragMode('resize-ne');
    } else if (onSW) {
      setDragMode('resize-sw');
    } else if (onSE) {
      setDragMode('resize-se');
    } else if (
      x >= selectionRect.x && 
      x <= selectionRect.x + selectionRect.width &&
      y >= selectionRect.y && 
      y <= selectionRect.y + selectionRect.height
    ) {
      setDragMode('move');
    } else {
      return;
    }
    
    setDragStart({ x, y });
    setDragStartRect({ ...selectionRect });
    
    // Prevent text selection while dragging
    e.preventDefault();
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || !dragStartRect || !dragMode) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;
    
    const minSize = 50; // Minimum size of selection rectangle
    const maxX = canvasRef.current!.width;
    const maxY = canvasRef.current!.height;
    
    if (dragMode === 'move') {
      const newX = Math.max(0, Math.min(maxX - dragStartRect.width, dragStartRect.x + deltaX));
      const newY = Math.max(0, Math.min(maxY - dragStartRect.height, dragStartRect.y + deltaY));
      
      setSelectionRect({
        ...dragStartRect,
        x: newX,
        y: newY
      });
    } else {
      // Handle resizing
      let newRect = { ...dragStartRect };
      
      switch (dragMode) {
        case 'resize-nw':
          newRect = {
            x: Math.min(dragStartRect.x + dragStartRect.width - minSize, dragStartRect.x + deltaX),
            y: Math.min(dragStartRect.y + dragStartRect.height - minSize, dragStartRect.y + deltaY),
            width: Math.max(minSize, dragStartRect.width - deltaX),
            height: Math.max(minSize, dragStartRect.height - deltaY)
          };
          break;
        case 'resize-ne':
          newRect = {
            x: dragStartRect.x,
            y: Math.min(dragStartRect.y + dragStartRect.height - minSize, dragStartRect.y + deltaY),
            width: Math.max(minSize, dragStartRect.width + deltaX),
            height: Math.max(minSize, dragStartRect.height - deltaY)
          };
          break;
        case 'resize-sw':
          newRect = {
            x: Math.min(dragStartRect.x + dragStartRect.width - minSize, dragStartRect.x + deltaX),
            y: dragStartRect.y,
            width: Math.max(minSize, dragStartRect.width - deltaX),
            height: Math.max(minSize, dragStartRect.height + deltaY)
          };
          break;
        case 'resize-se':
          newRect = {
            x: dragStartRect.x,
            y: dragStartRect.y,
            width: Math.max(minSize, dragStartRect.width + deltaX),
            height: Math.max(minSize, dragStartRect.height + deltaY)
          };
          break;
      }
      
      // Ensure the selection stays within canvas bounds
      newRect.x = Math.max(0, Math.min(maxX - newRect.width, newRect.x));
      newRect.y = Math.max(0, Math.min(maxY - newRect.height, newRect.y));
      newRect.width = Math.min(maxX - newRect.x, newRect.width);
      newRect.height = Math.min(maxY - newRect.y, newRect.height);
      
      setSelectionRect(newRect);
    }
    
    // Prevent text selection while dragging
    e.preventDefault();
  };
  
  const handleMouseUp = () => {
    setDragStart(null);
    setDragStartRect(null);
    setDragMode(null);
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
  
  const captureBlackoutCalibration = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      
      if (!canvas || !ctx || !selectionRect) {
        console.error("Cannot capture blackout calibration: canvas or selection not ready");
        return;
      }
      
      const { x, y, width, height } = selectionRect;
      // Extract the selected region's image data during "blackout" condition
      const blackoutData = ctx.getImageData(x, y, width, height);
      
      console.log("captureBlackoutCalibration: Captured blackout data", 
        `${blackoutData.width}x${blackoutData.height}`);
      
      // Store the blackout calibration data directly in the ref
      blackoutCalibrationRef.current = blackoutData;
      
      // Also update the state
      setBlackoutCalibrationData(blackoutData);
      
      // CRITICAL: Also call onBlackoutCalibrated to update the parent state
      if (onBlackoutCalibrated) {
        console.log("captureBlackoutCalibration: Calling onBlackoutCalibrated callback");
        onBlackoutCalibrated(blackoutData);
      } else {
        console.warn("captureBlackoutCalibration: No onBlackoutCalibrated callback provided");
      }
      
      setIsCalibrated(true);
    } catch (error) {
      console.error("Error capturing blackout calibration:", error);
    }
  }, [selectionRect, onBlackoutCalibrated]);
  
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
        <div className="bg-black w-full aspect-video flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full">
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-contain"
              playsInline 
              muted
            />
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full object-contain z-10" 
              style={{ pointerEvents: 'auto' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
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
          {checkFocusSupport() && (
            <Toggle
              aria-label="Disable autofocus"
              pressed={focusMode === 'manual'}
              onPressedChange={(pressed) => {
                const newMode = pressed ? 'manual' : 'auto';
                setFocusMode(newMode);
                
                // If we have an active stream, update its focus mode
                if (stream) {
                  const videoTrack = stream.getVideoTracks()[0];
                  if (videoTrack) {
                    void applyAdvancedCameraSettings(videoTrack, {
                      disableAutofocus: newMode === 'manual'
                    });
                  }
                }
              }}
            >
              Manual Focus
            </Toggle>
          )}
        </div>
      </CardFooter>
      <CardFooter className="flex flex-wrap gap-2 pt-0 pb-4 px-3">
        <Button 
          onClick={captureReference} 
          variant="secondary" 
          className="flex-1 min-w-[140px]"
        >
          Capture Reference
        </Button>
        
        <Button 
          onClick={captureSample} 
          variant="secondary" 
          className="flex-1 min-w-[140px]"
        >
          Capture Sample
        </Button>
        
        <Button
          onClick={captureBlackoutCalibration}
          variant={isCalibrated ? "outline" : "secondary"}
          className="flex-1 min-w-[140px] relative"
        >
          {isCalibrated ? (
            <>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-background"></span>
              Recalibrate Blackout
            </>
          ) : (
            <>Calibrate Blackout</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 