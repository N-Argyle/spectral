/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { SpectralCanvas } from "./Canvas";
import { 
  processImageData, 
  calculateAbsorbance,
  pixelToWavelength
} from "./utils";

interface AbsorbanceSpectrumProps {
  referenceFrame?: ImageData;
  sampleFrame?: ImageData;
  onDataProcessed?: (data: { wavelength: number; absorbance: number }[]) => void;
}

export function AbsorbanceSpectrum({ 
  referenceFrame, 
  sampleFrame,
  onDataProcessed
}: AbsorbanceSpectrumProps) {
  // Use ref to track previous data to avoid unnecessary updates
  const previousDataRef = useRef<string>("");
  
  // Separate data processing from rendering to avoid render loops
  useEffect(() => {
    if (!referenceFrame || !sampleFrame || !onDataProcessed) return;
    
    // Process the image data to create intensity arrays
    const referenceIntensity = processImageData(referenceFrame);
    const sampleIntensity = processImageData(sampleFrame);
    
    // Calculate absorbance
    const absorbanceData = calculateAbsorbance(referenceIntensity, sampleIntensity);
    
    // Create absorbance data for potential use elsewhere
    const processedData = absorbanceData.map((abs, index) => ({
      wavelength: pixelToWavelength(index, referenceFrame.width),
      absorbance: abs
    }));
    
    // Stringify to compare with previous data
    const dataString = JSON.stringify(processedData);
    
    // Only notify parent if data has changed
    if (dataString !== previousDataRef.current) {
      previousDataRef.current = dataString;
      onDataProcessed(processedData);
    }
  }, [referenceFrame, sampleFrame, onDataProcessed]);

  const handleCanvasReady = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    if (!referenceFrame || !sampleFrame) return;
    
    // Process the image data to create intensity arrays
    const referenceIntensity = processImageData(referenceFrame);
    const sampleIntensity = processImageData(sampleFrame);
    
    // Calculate absorbance
    const absorbanceData = calculateAbsorbance(referenceIntensity, sampleIntensity);
    
    // Find min and max values for scaling
    let minAbsorbance = 0;
    let maxAbsorbance = 0;
    
    absorbanceData.forEach(value => {
      if (typeof value === 'number' && !isNaN(value)) {
        minAbsorbance = Math.min(minAbsorbance, value);
        maxAbsorbance = Math.max(maxAbsorbance, value);
      }
    });
    
    // Force a 0 to 1 scale regardless of actual values
    minAbsorbance = 0;
    maxAbsorbance = 1;
    
    // Use more of the available height for the graph content
    const margin = {
      top: 30,
      right: 20,
      bottom: 60, // Increased to accommodate the gradient and labels
      left: 60     // Increased to match other graphs
    };
    
    const graphHeight = displayHeight - margin.top - margin.bottom;
    // const graphWidth = displayWidth - margin.left - margin.right;
    
    // In the new layout, zero is at the bottom
    const zeroY = displayHeight - margin.bottom;
    
    // Clear background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Y-axis label
    ctx.save();
    ctx.translate(15, displayHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText('Absorbance', 0, 0);
    ctx.restore();
    
    // Draw X axis at the bottom (zero line)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(displayWidth - margin.right, zeroY);
    
    // Draw y-axis
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, zeroY);
    ctx.stroke();

    // Draw X axis labels (wavelengths)
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    for (let wl = 400; wl <= 700; wl += 100) {
      const x = margin.left + ((wl - 380) / (750 - 380)) * (displayWidth - margin.left - margin.right);
      ctx.fillText(`${wl}nm`, x, displayHeight - margin.bottom + 25);
    }
    
    // Draw Y axis labels (absorbance) for positive values only
    ctx.textAlign = 'right';
    ctx.fillStyle = '#aaa'; // Brighter color for better visibility
    ctx.font = '12px sans-serif'; // Slightly larger font
    
    // Draw tick marks on the y-axis
    // Major ticks (labeled)
    const majorStep = 0.2;
    // Minor ticks (unlabeled)
    const minorStep = 0.1;
    
    // Draw minor ticks first
    for (let a = minorStep; a < maxAbsorbance; a += minorStep) {
      if (a % majorStep === 0) continue; // Skip positions where major ticks will go
      const y = zeroY - (a / maxAbsorbance) * graphHeight;
      
      // Draw small tick mark
      ctx.beginPath();
      ctx.moveTo(margin.left - 3, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }
    
    // Draw major ticks with labels
    for (let a = 0; a <= maxAbsorbance; a += majorStep) {
      const y = zeroY - (a / maxAbsorbance) * graphHeight;
      
      // Draw major tick mark
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
      
      // Draw label
      ctx.fillText(a.toFixed(1), margin.left - 8, y + 4);
    }
    
    // Draw y-axis title
    ctx.save();
    ctx.translate(15, (zeroY + margin.top) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText("Absorbance (A)", 0, 0);
    ctx.restore();
    
    // Draw grid lines for better readability - horizontal grid lines
    ctx.strokeStyle = '#333';
    ctx.setLineDash([2, 3]);
    
    // Horizontal grid lines
    for (let a = 0; a <= maxAbsorbance; a += majorStep) {
      const y = zeroY - (a / maxAbsorbance) * graphHeight;
      
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(displayWidth - margin.right, y);
      ctx.stroke();
    }
    
    // Reset dash pattern
    ctx.setLineDash([]);
    
    // Draw spectral region indicators - gradient band to highlight wavelength regions
    const spectrumRegionHeight = 15;
    const spectrumY = displayHeight - margin.bottom + 5; // Just below the x-axis
    
    // Create a gradient for the spectral regions
    const spectralGradient = ctx.createLinearGradient(
      margin.left, // x0
      spectrumY, // y0
      displayWidth - margin.right, // x1
      spectrumY // y1
    );
    
    // Add color stops for the spectral gradient (blue -> green -> red)
    spectralGradient.addColorStop(0, 'rgba(0, 0, 255, 0.5)');      // Blue at 380nm
    spectralGradient.addColorStop(0.3, 'rgba(0, 255, 255, 0.5)');  // Cyan at ~450nm
    spectralGradient.addColorStop(0.4, 'rgba(0, 255, 0, 0.5)');    // Green at ~500nm
    spectralGradient.addColorStop(0.6, 'rgba(255, 255, 0, 0.5)');  // Yellow at ~580nm
    spectralGradient.addColorStop(0.8, 'rgba(255, 0, 0, 0.5)');    // Red at ~650nm
    spectralGradient.addColorStop(1, 'rgba(128, 0, 128, 0.5)');    // Purple at 750nm
    
    // Draw the gradient band
    ctx.fillStyle = spectralGradient;
    ctx.fillRect(margin.left, spectrumY, displayWidth - margin.left - margin.right, spectrumRegionHeight);
    
    // Draw border for the gradient band
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, spectrumY, displayWidth - margin.left - margin.right, spectrumRegionHeight);
    
    // Add labels for the regions
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    
    // Position labels along the gradient
    const labelPositions = [
      { label: 'Blue', x: margin.left + (displayWidth - margin.left - margin.right) * 0.15, y: spectrumY + spectrumRegionHeight + 10 },
      { label: 'Green', x: margin.left + (displayWidth - margin.left - margin.right) * 0.5, y: spectrumY + spectrumRegionHeight + 10 },
      { label: 'Red', x: margin.left + (displayWidth - margin.left - margin.right) * 0.85, y: spectrumY + spectrumRegionHeight + 10 }
    ];
    
    // Draw each label with a dark background for better visibility
    labelPositions.forEach(({ label, x, y }) => {
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x - textWidth/2 - 2, y - 9, textWidth + 4, 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y);
    });
    
    // Draw the absorbance spectrum
    const peakData = drawAbsorbanceLine(
      ctx,
      absorbanceData,
      displayWidth,
      displayHeight,
      minAbsorbance,
      maxAbsorbance,
      zeroY
    );
    
    // Label peaks with their values
    ctx.font = '12px sans-serif'; // Larger font for better visibility
    ctx.textAlign = 'center';
    
    peakData.forEach(peak => {
      const { x, y, value, wavelength } = peak;
      
      // Draw a more visible dot at the peak
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw a background rectangle for the label text to improve readability
      const absText = `A=${value.toFixed(2)}`;
      const textWidth = ctx.measureText(absText).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x - textWidth/2 - 4, y - 24, textWidth + 8, 18);
      
      // Draw the absorbance value above the peak
      ctx.fillStyle = 'rgba(255, 220, 220, 1.0)';
      ctx.fillText(absText, x, y - 12);
      
      // Draw the wavelength below (if there's space)
      if (y < displayHeight - 60) {
        const wlText = `${wavelength}nm`;
        const wlWidth = ctx.measureText(wlText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - wlWidth/2 - 4, y + 6, wlWidth + 8, 18);
        
        ctx.fillStyle = 'rgba(255, 220, 220, 1.0)';
        ctx.fillText(wlText, x, y + 18);
      }
    });
  }, [referenceFrame, sampleFrame]);

  // Special drawing function for absorbance with custom scaling
  const drawAbsorbanceLine = useCallback((
    ctx: CanvasRenderingContext2D,
    data: number[],
    displayWidth: number,
    displayHeight: number,
    minAbsorbance: number,
    maxAbsorbance: number,
    zeroY: number
  ) => {
    // Use the margin values from the parent function
    const margin = {
      top: 30,
      right: 20,
      bottom: 60,
      left: 40
    };
    
    const graphHeight = displayHeight - margin.top - margin.bottom;
    
    // Scale the x-coordinates for better smooth rendering
    const xScale = (displayWidth - margin.left - margin.right) / (data.length - 1);
    
    // Prepare for peak detection
    // Different thresholds for different regions
    const peakThresholdBlue = 0.05;  // For blue region (380-490nm)
    const peakThresholdGreen = 0.05; // For green region (490-580nm) - Lower to detect absorbance in green
    const peakThresholdRed = 0.05;   // For red region (580-750nm)
    const peakProximity = 25; // Minimum x-distance between peaks
    const peaks: Array<{x: number, y: number, value: number, wavelength: number}> = [];
    const points: Array<{x: number, y: number, value: number, index: number, wavelength: number}> = [];
    
    // Prepare to draw
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Helper function to convert absorbance to y-coordinate
    const absToY = (abs: number): number => {
      // Map absorbance value to y-coordinate (higher absorbance = higher up)
      // Clamp values to 0-1 range
      const clampedAbs = Math.max(0, Math.min(1, abs));
      return zeroY - (clampedAbs / maxAbsorbance) * graphHeight;
    };
    
    // Start the path
    if (data[0] !== undefined) {
      // Normalize value to 0-1 range
      const value = Math.abs(data[0] ?? 0); // Use absolute value to make all absorbance positive
      const clampedValue = Math.min(maxAbsorbance, value);
      const firstY = absToY(clampedValue);
      ctx.moveTo(margin.left, firstY);
      
      // Calculate wavelength for this point
      const wavelength = pixelToWavelength(0, data.length);
      
      // Add first point to points array
      points.push({
        x: margin.left,
        y: firstY,
        value: clampedValue,
        index: 0,
        wavelength
      });
    } else {
      ctx.moveTo(margin.left, zeroY);
    }
    
    // Connect all points with a scaled approach
    for (let x = 1; x < data.length; x++) {
      if (data[x] !== undefined) {
        // Normalize value to 0-1 range
        const value = Math.abs(data[x] ?? 0); // Use absolute value to make all absorbance positive
        const clampedValue = Math.min(maxAbsorbance, value);
        const y = absToY(clampedValue);
        const xPos = margin.left + x * xScale;
        
        // Calculate wavelength for this point
        const wavelength = pixelToWavelength(x, data.length);
        
        ctx.lineTo(xPos, y);
        
        // Add point to points array (for peak detection)
        points.push({
          x: xPos,
          y: y,
          value: clampedValue,
          index: x,
          wavelength
        });
      }
    }
    
    // Style and draw
    ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
    ctx.lineWidth = 2;
    
    // Add shadow for better visibility
    ctx.shadowColor = 'rgba(255, 80, 80, 0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Find peaks - look for local maxima in the absorbance data
    // First, smooth the data points with a simple moving average to reduce noise
    const smoothedPoints: Array<{x: number, y: number, value: number, index: number, wavelength: number}> = [];
    const windowSize = 5; // Size of the moving average window
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || 
          typeof point.value !== 'number' || typeof point.index !== 'number' ||
          typeof point.wavelength !== 'number') {
        continue; // Skip invalid points
      }
      
      let sum = 0;
      let count = 0;
      
      // Compute moving average over the window
      for (let j = Math.max(0, i - Math.floor(windowSize/2)); 
           j <= Math.min(points.length - 1, i + Math.floor(windowSize/2)); j++) {
        const windowPoint = points[j];
        if (windowPoint && typeof windowPoint.value === 'number') {
          sum += windowPoint.value;
          count++;
        }
      }
      
      if (count > 0) {
        // Create a smoothed point with the same properties but averaged value
        smoothedPoints.push({
          x: point.x,
          y: point.y,
          index: point.index,
          value: sum / count,
          wavelength: point.wavelength
        });
      }
    }
    
    // Now detect peaks on the smoothed data
    for (let i = 2; i < smoothedPoints.length - 2; i++) {
      const prev2 = smoothedPoints[i - 2];
      const prev1 = smoothedPoints[i - 1];
      const curr = smoothedPoints[i];
      const next1 = smoothedPoints[i + 1];
      const next2 = smoothedPoints[i + 2];
      
      // Check if all points are defined
      if (!prev2 || !prev1 || !curr || !next1 || !next2) continue;
      
      // A peak must be higher than its neighbors and the neighbors' neighbors
      if (typeof curr.value === 'number' && 
          typeof prev1.value === 'number' && 
          typeof prev2.value === 'number' &&
          typeof next1.value === 'number' && 
          typeof next2.value === 'number' &&
          typeof curr.wavelength === 'number') {
        
        // Get the appropriate threshold based on the wavelength region
        let threshold = peakThresholdRed; // Default
        
        if (curr.wavelength < 490) {
          threshold = peakThresholdBlue;
        } else if (curr.wavelength < 580) {
          threshold = peakThresholdGreen;
        } else {
          threshold = peakThresholdRed;
        }
        
        const isPeak = curr.value > prev1.value && 
                       curr.value > prev2.value && 
                       curr.value > next1.value && 
                       curr.value > next2.value && 
                       curr.value > threshold;
                       
        if (isPeak) {
          // Check if we're far enough from the last detected peak
          const farEnough = peaks.every(peak => Math.abs(peak.x - curr.x) > peakProximity);
          
          if (farEnough) {            
            peaks.push({
              x: curr.x,
              y: curr.y,
              value: curr.value,
              wavelength: curr.wavelength
            });
          }
        }
      }
    }
    
    return peaks;
  }, []);

  return (
    <div className="rounded-md overflow-hidden bg-black">
      <SpectralCanvas
        className="w-full"
        onCanvasReady={handleCanvasReady}
        height={250}
      />
    </div>
  );
} 