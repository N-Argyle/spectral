"use client";

import { useCallback } from "react";
import { SpectralCanvas } from "./Canvas";
import { drawAxes, drawSpectralLine, processImageData } from "./utils";

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
    
    // Draw the axes
    drawAxes(ctx, displayWidth, displayHeight);
    
    // Draw the spectral line
    drawSpectralLine(
      ctx,
      intensityData,
      displayWidth,
      displayHeight,
      "rgba(255, 255, 255, 0.8)",
      "rgba(255, 255, 255, 0.3)"
    );
  }, [referenceFrame]);

  return (
    <div className="rounded-md overflow-hidden bg-black">
      <SpectralCanvas
        className="w-full"
        onCanvasReady={handleCanvasReady}
      />
    </div>
  );
} 