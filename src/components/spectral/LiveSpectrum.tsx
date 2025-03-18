"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpectralCanvas } from "./Canvas";
import { 
  drawAxes, 
  drawSpectralLine, 
  createSpectrumGradient, 
  processImageData, 
  pixelToWavelength 
} from "./utils";

interface LiveSpectrumProps {
  currentFrame: ImageData | null;
  blackoutCalibrationData?: ImageData | null;
  onDataProcessed?: (data: { wavelength: number; intensity: number }[]) => void;
}

export default function LiveSpectrum({ currentFrame, blackoutCalibrationData, onDataProcessed }: LiveSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Initialize with empty array, which is stable and won't cause re-renders
  const [intensityData, setIntensityData] = useState<number[]>(() => []);
  
  // Use refs for stateful data that shouldn't trigger re-renders
  const lastValidSpectrumRef = useRef<number[]>([]);
  const emptyFrameCountRef = useRef(0);
  const EMPTY_FRAME_THRESHOLD = 15; // Increase threshold for more stability
  
  // Create a ref to store the last processed data string to avoid unnecessary updates
  const lastProcessedDataRef = useRef<string>('');
  // Process the current frame when it updates - use refs to remember last values
  const lastProcessedFrameRef = useRef<string>('');
  
  // Add a ref to track the maximum value seen for better scaling
  const maxSeenValueRef = useRef<number>(0);
  
  // Reset processed data when calibration data changes
  const lastCalibrationKeyRef = useRef<string | null>(null);
  
  // Process the current frame when it updates - use refs to remember last values
  useEffect(() => {
    if (!currentFrame) {
      console.log("LiveSpectrum: No current frame available");
      return;
    }
    
    // Generate a string key for this frame + calibration combination
    const frameKey = `${currentFrame.width}x${currentFrame.height}`;
    const calibKey = blackoutCalibrationData ? 
      `calib-${blackoutCalibrationData.width}x${blackoutCalibrationData.height}` : 'no-calib';
    const processingKey = `${frameKey}-${calibKey}`;
    
    // Skip if we've already processed this exact frame with the same calibration data
    if (processingKey === lastProcessedFrameRef.current) {
      // For live spectrum, we want to process every frame to ensure a smooth update
      // Just log this for debugging but continue processing
      console.log("LiveSpectrum: Processing new frame data");
    }
    
    // Remember this frame + calibration combination
    lastProcessedFrameRef.current = processingKey;
    
    // Process the current frame - ensure we pass undefined instead of null for blackoutCalibrationData
    const processedData = processImageData(
      currentFrame, 
      blackoutCalibrationData ?? undefined
    );
    
    // Apply a normalization step to ensure values are properly scaled
    // Find max value for this frame
    const frameMax = Math.max(...processedData.filter(v => typeof v === 'number' && !isNaN(v)), 0.01);
    
    // Update rolling maximum with some decay to adapt to changing conditions
    if (frameMax > maxSeenValueRef.current) {
      maxSeenValueRef.current = frameMax;
    } else {
      // Slowly decay max value to adjust to changing conditions (10% decay)
      maxSeenValueRef.current = 0.9 * maxSeenValueRef.current + 0.1 * frameMax;
    }
    
    console.log("Current max value:", maxSeenValueRef.current);
    
    // Create a local copy to avoid any potential mutation issues
    // Also normalize values to a more consistent range
    const safeProcessedData = processedData.map(v => {
      if (typeof v !== 'number' || isNaN(v)) return 0;
      // Normalize to a reasonable range for display
      return v / maxSeenValueRef.current;
    });
    
    // Reset empty frame counter when we get a new frame
    emptyFrameCountRef.current = 0;
    
    // Update last valid spectrum
    lastValidSpectrumRef.current = [...safeProcessedData];
    
    // Always update the displayed data
    console.log("LiveSpectrum: Updating with processed data, length:", safeProcessedData.length);
    setIntensityData([...safeProcessedData]);
  }, [currentFrame, blackoutCalibrationData]);

  // Update the processed data when intensity data changes
  useEffect(() => {
    if (!onDataProcessed || intensityData.length === 0) return;
    
    // Convert intensity data to wavelength/intensity pairs
    const processedDataString = JSON.stringify(intensityData);
    
    // Use a ref to store the last processed data to avoid unnecessary updates
    if (lastProcessedDataRef.current === processedDataString) {
      return; // Skip if the data hasn't changed
    }
    
    lastProcessedDataRef.current = processedDataString;
    
    const spectrumData = intensityData.map((intensity, index) => ({
      wavelength: pixelToWavelength(index, intensityData.length),
      intensity
    }));
    
    onDataProcessed(spectrumData);
  }, [intensityData, onDataProcessed]);

  // Reset processed data when calibration data changes
  useEffect(() => {
    // Generate a unique key for the current calibration data
    const calibKey = blackoutCalibrationData 
      ? `${blackoutCalibrationData.width}x${blackoutCalibrationData.height}` 
      : null;
    
    // Skip if this is the same calibration data we already processed
    if (calibKey === lastCalibrationKeyRef.current) {
      return;
    }
    
    // Track this calibration data
    lastCalibrationKeyRef.current = calibKey;
    
    console.log("LiveSpectrum: blackoutCalibrationData changed:", calibKey ?? "null");
    
    // When blackoutCalibrationData changes, we should reset our references
    lastProcessedDataRef.current = '';
    lastValidSpectrumRef.current = [];
    emptyFrameCountRef.current = 0;
    maxSeenValueRef.current = 0; // Reset max seen value
    
    // Just clear the intensity data, and the next frame will be processed with new calibration
    setIntensityData([]);
  }, [blackoutCalibrationData]);

  const handleCanvasReady = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    try {
      // Clear the canvas with a solid background for better performance
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Draw axes with better anti-aliasing
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#666';
      // Use 0.5 offset for crisp lines on pixel boundaries
      ctx.beginPath();
      ctx.moveTo(20.5, displayHeight - 20.5);
      ctx.lineTo(displayWidth - 20.5, displayHeight - 20.5);
      ctx.moveTo(20.5, 20.5);
      ctx.lineTo(20.5, displayHeight - 20.5);
      ctx.stroke();
      
      // Draw tick marks and labels
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      for (let wl = 400; wl <= 700; wl += 100) {
        const x = 20 + ((wl - 380) / (750 - 380)) * (displayWidth - 40);
        ctx.fillText(`${wl}nm`, x, displayHeight - 5);
      }
    
      // Draw spectral reference bar
      const referenceHeight = 10;
      const gradient = createSpectrumGradient(ctx, displayWidth);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, displayHeight - 20 - referenceHeight, displayWidth, referenceHeight);
    
      // Draw RGB labels with improved contrast and positioning
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px sans-serif';
      const blueX = ((450 - 380) / (750 - 380)) * displayWidth;
      ctx.fillText('B', blueX - 4, displayHeight - 22 - referenceHeight);
      const greenX = ((550 - 380) / (750 - 380)) * displayWidth;
      ctx.fillText('G', greenX - 4, displayHeight - 22 - referenceHeight);
      const redX = ((650 - 380) / (750 - 380)) * displayWidth;
      ctx.fillText('R', redX - 4, displayHeight - 22 - referenceHeight);
    
      // Create a local copy of data to avoid any state inconsistencies
      const currentIntensityData = [...intensityData];
      const hasCalibration = blackoutCalibrationData !== null && blackoutCalibrationData !== undefined;
      
      // Use a better check for emptiness - check if it has any significant values
      const hasSignificantValues = currentIntensityData.some(v => v > 0.1);
      
      // Draw spectrum data if available
      if (currentIntensityData.length > 0) {
        // Use a more moderate intensity multiplier to prevent off-chart values
        // Scale is now better managed in the preprocessing step
        const intensityMultiplier = 1.2;
        
        // Use enhanced drawing with anti-aliasing and smoother lines
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        
        drawSpectralLine(ctx, currentIntensityData, displayWidth, displayHeight, gradient, 'rgba(0, 0, 0, 0.5)', intensityMultiplier);
        
        // Only show a message for very weak signals, but don't hide the visualization
        if (!hasSignificantValues && hasCalibration) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Signal boosted for visibility', displayWidth / 2, 20);
        }
      } else {
        // Draw flat line for empty spectrum
        ctx.beginPath();
        ctx.moveTo(20, displayHeight - 20);
        ctx.lineTo(displayWidth - 20, displayHeight - 20);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } catch (error) {
      console.error("Error rendering canvas:", error);
    }
  }, [intensityData, blackoutCalibrationData]);
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const displayWidth = canvasRef.current?.width ?? 0;
    const displayHeight = canvasRef.current?.height ?? 0;
    
    handleCanvasReady(ctx, displayWidth, displayHeight);
  }, [handleCanvasReady]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <SpectralCanvas
        className="w-full h-full"
        onCanvasReady={handleCanvasReady}
        height={300}
      />
    </div>
  );
}