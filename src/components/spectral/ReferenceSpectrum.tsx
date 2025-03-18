"use client";

import { useCallback } from "react";
import { SpectralCanvas } from "./Canvas";
import { drawEnhancedAxes, drawEnhancedSpectralLine, processImageData } from "./utils";

interface ReferenceSpectrumProps {
  referenceFrame?: ImageData;
}

export function ReferenceSpectrum({ referenceFrame }: ReferenceSpectrumProps) {
  const handleCanvasReady = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    if (!referenceFrame) return;
    
    // Process the image data
    const intensityData = processImageData(referenceFrame);
    
    // Draw the enhanced axes with grid
    drawEnhancedAxes(ctx, displayWidth, displayHeight, 100);
    
    // Draw the spectral line with enhanced visualization
    drawEnhancedSpectralLine(
      ctx,
      intensityData,
      displayWidth,
      displayHeight,
      "rgba(255, 255, 255, 0.8)",
      "rgba(255, 255, 255, 0.3)",
      0.95 // Using a slightly lower intensity multiplier for better display
    );
  }, [referenceFrame]);

  return (
    <div className="rounded-md overflow-hidden bg-black">
      <SpectralCanvas
        className="w-full"
        onCanvasReady={handleCanvasReady}
        height={250} // Increased height for better visualization
      />
    </div>
  );
} 