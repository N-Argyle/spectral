"use client";

import { useCallback } from "react";
import { SpectralCanvas } from "./Canvas";
import { drawAxes, drawSpectralLine, processImageData } from "./utils";

interface SampleSpectrumProps {
  sampleFrame?: ImageData;
}

export function SampleSpectrum({ sampleFrame }: SampleSpectrumProps) {
  const handleCanvasReady = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    if (!sampleFrame) return;
    
    // Process the image data
    const intensityData = processImageData(sampleFrame);
    
    // Draw the axes
    drawAxes(ctx, displayWidth, displayHeight);
    
    // Draw the spectral line
    drawSpectralLine(
      ctx,
      intensityData,
      displayWidth,
      displayHeight,
      "rgba(0, 200, 255, 0.8)",
      "rgba(0, 200, 255, 0.3)"
    );
  }, [sampleFrame]);

  return (
    <div className="rounded-md overflow-hidden bg-black">
      <SpectralCanvas
        className="w-full"
        onCanvasReady={handleCanvasReady}
      />
    </div>
  );
} 