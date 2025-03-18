"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface SpectralAnalysisProps {
  currentFrame?: ImageData;
  referenceFrame?: ImageData;
  sampleFrame?: ImageData;
}

export default function SpectralAnalysis({
  currentFrame,
  referenceFrame,
  sampleFrame,
}: SpectralAnalysisProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement>(null);
  const absorbanceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState("live");
  const [hasReference, setHasReference] = useState(false);
  const [hasSample, setHasSample] = useState(false);
  const [spectrumData, setSpectrumData] = useState<{ wavelength: number, intensity: number }[]>([]);
  const [absorbanceData, setAbsorbanceData] = useState<{ wavelength: number, absorbance: number }[]>([]);

  // Convert pixel position to approximate wavelength (very approximate)
  const pixelToWavelength = (pixelPos: number, totalWidth: number): number => {
    // This is a very simplified conversion - would need calibration in a real device
    // Assuming visible spectrum 380-750nm mapped across the width
    const minWavelength = 380;
    const maxWavelength = 750;
    const wavelength = minWavelength + (pixelPos / totalWidth) * (maxWavelength - minWavelength);
    return Math.round(wavelength);
  };

  // Setup canvas with proper device pixel ratio to prevent pixelation
  const setupHiDPICanvas = (canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null => {
    // Get the device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    
    // Set display size (css pixels)
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    
    // Set actual size in memory (scaled for device pixel ratio)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Get context and scale all drawing operations by the dpr
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    
    ctx.scale(dpr, dpr);
    
    // Enable higher quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    return ctx;
  };

  // Process live frames
  useEffect(() => {
    if (!canvasRef.current || !currentFrame) return;

    const canvas = canvasRef.current;
    const displayWidth = canvas.clientWidth;
    const displayHeight = 150; // Fixed height for the graph
    
    // Setup hi-DPI canvas to prevent pixelation
    const ctx = setupHiDPICanvas(canvas, displayWidth, displayHeight);
    if (!ctx) return;
    
    // Process the image data to create a spectrum
    const intensityByPosition = Array(currentFrame.width).fill(0) as number[];
    
    // For each column, sum up the RGB values
    for (let x = 0; x < currentFrame.width; x++) {
      let totalIntensity = 0;
      
      for (let y = 0; y < currentFrame.height; y++) {
        const i = (y * currentFrame.width + x) * 4;
        const r = currentFrame.data[i] ?? 0;
        const g = currentFrame.data[i + 1] ?? 0;
        const b = currentFrame.data[i + 2] ?? 0;
        
        // Sum RGB as a simple measure of intensity
        totalIntensity += (r + g + b);
      }
      
      // Average intensity for this column
      intensityByPosition[x] = totalIntensity / (currentFrame.height * 3); // Divide by height and 3 channels
    }
    
    // Find max for scaling
    const maxIntensity = Math.max(...intensityByPosition);
    
    // Create normalized data for the line graph
    const newSpectrumData = intensityByPosition.map((intensity, index) => ({
      wavelength: pixelToWavelength(index, currentFrame.width),
      intensity: intensity
    }));
    
    setSpectrumData(newSpectrumData);
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, displayHeight - 20);
    ctx.lineTo(displayWidth, displayHeight - 20);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, displayHeight - 20);
    ctx.stroke();
    
    // X-axis labels (wavelength)
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // Add wavelength markers
    for (let wl = 400; wl <= 700; wl += 50) {
      const x = ((wl - 380) / (750 - 380)) * displayWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, displayHeight - 20);
      ctx.lineTo(x, displayHeight - 15);
      ctx.stroke();
      
      ctx.fillText(`${wl}nm`, x, displayHeight - 5);
    }
    
    // Draw the spectrum with improved rendering
    ctx.beginPath();
    
    // Set line style for better quality
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Scale the x-coordinates for better smooth rendering
    const scaleX = displayWidth / currentFrame.width;
    
    // Start the path
    if (intensityByPosition[0] !== undefined) {
      const firstY = displayHeight - 20 - ((intensityByPosition[0] ?? 0) / maxIntensity) * (displayHeight - 30);
      ctx.moveTo(0, firstY);
    } else {
      ctx.moveTo(0, displayHeight - 20);
    }
    
    // Connect all points with a scaled approach
    for (let x = 1; x < intensityByPosition.length; x++) {
      if (intensityByPosition[x] !== undefined) {
        const y = displayHeight - 20 - ((intensityByPosition[x] ?? 0) / maxIntensity) * (displayHeight - 30);
        ctx.lineTo(x * scaleX, y);
      }
    }
    
    // Color gradient for spectrum
    const gradient = ctx.createLinearGradient(0, 0, displayWidth, 0);
    gradient.addColorStop(0, "rgba(80, 0, 140, 0.8)"); // Violet
    gradient.addColorStop(0.17, "rgba(0, 0, 255, 0.8)"); // Blue
    gradient.addColorStop(0.33, "rgba(0, 255, 0, 0.8)"); // Green
    gradient.addColorStop(0.5, "rgba(255, 255, 0, 0.8)"); // Yellow
    gradient.addColorStop(0.67, "rgba(255, 127, 0, 0.8)"); // Orange
    gradient.addColorStop(0.83, "rgba(255, 0, 0, 0.8)"); // Red
    gradient.addColorStop(1, "rgba(200, 0, 0, 0.8)"); // Deep Red
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    
    // Add shadow for better visibility and anti-aliasing effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.stroke();
    
  }, [currentFrame]);

  // Process reference frame if available
  useEffect(() => {
    if (!referenceCanvasRef.current || !referenceFrame) return;
    setHasReference(true);
    
    const canvas = referenceCanvasRef.current;
    const displayWidth = canvas.clientWidth;
    const displayHeight = 150;
    
    // Setup hi-DPI canvas to prevent pixelation
    const ctx = setupHiDPICanvas(canvas, displayWidth, displayHeight);
    if (!ctx) return;
    
    // Process the image data to create a spectrum (same as for current frame)
    const intensityByPosition = Array(referenceFrame.width).fill(0) as number[];
    
    for (let x = 0; x < referenceFrame.width; x++) {
      let totalIntensity = 0;
      
      for (let y = 0; y < referenceFrame.height; y++) {
        const i = (y * referenceFrame.width + x) * 4;
        const r = referenceFrame.data[i] ?? 0;
        const g = referenceFrame.data[i + 1] ?? 0;
        const b = referenceFrame.data[i + 2] ?? 0;
        
        totalIntensity += (r + g + b);
      }
      
      intensityByPosition[x] = totalIntensity / (referenceFrame.height * 3);
    }
    
    // Find max for scaling
    const maxIntensity = Math.max(...intensityByPosition);
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, displayHeight - 20);
    ctx.lineTo(displayWidth, displayHeight - 20);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, displayHeight - 20);
    ctx.stroke();
    
    // X-axis labels (wavelength)
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // Add wavelength markers
    for (let wl = 400; wl <= 700; wl += 50) {
      const x = ((wl - 380) / (750 - 380)) * displayWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, displayHeight - 20);
      ctx.lineTo(x, displayHeight - 15);
      ctx.stroke();
      
      ctx.fillText(`${wl}nm`, x, displayHeight - 5);
    }
    
    // Draw the spectrum with improved rendering
    ctx.beginPath();
    
    // Set line style for better quality
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Scale the x-coordinates for better smooth rendering
    const scaleX = displayWidth / referenceFrame.width;
    
    // Start the path
    if (intensityByPosition[0] !== undefined) {
      const firstY = displayHeight - 20 - ((intensityByPosition[0] ?? 0) / maxIntensity) * (displayHeight - 30);
      ctx.moveTo(0, firstY);
    } else {
      ctx.moveTo(0, displayHeight - 20);
    }
    
    // Connect all points with a scaled approach
    for (let x = 1; x < intensityByPosition.length; x++) {
      if (intensityByPosition[x] !== undefined) {
        const y = displayHeight - 20 - ((intensityByPosition[x] ?? 0) / maxIntensity) * (displayHeight - 30);
        ctx.lineTo(x * scaleX, y);
      }
    }
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    
    // Add shadow for better visibility
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.stroke();
    
  }, [referenceFrame]);

  // Process sample frame and calculate absorbance
  useEffect(() => {
    if (!sampleCanvasRef.current || !sampleFrame) return;
    setHasSample(true);
    
    const canvas = sampleCanvasRef.current;
    const displayWidth = canvas.clientWidth;
    const displayHeight = 150;
    
    // Setup hi-DPI canvas to prevent pixelation
    const ctx = setupHiDPICanvas(canvas, displayWidth, displayHeight);
    if (!ctx) return;
    
    // Process the image data to create a spectrum (same as for current frame)
    const intensityByPosition = Array(sampleFrame.width).fill(0) as number[];
    
    for (let x = 0; x < sampleFrame.width; x++) {
      let totalIntensity = 0;
      
      for (let y = 0; y < sampleFrame.height; y++) {
        const i = (y * sampleFrame.width + x) * 4;
        const r = sampleFrame.data[i] ?? 0;
        const g = sampleFrame.data[i + 1] ?? 0;
        const b = sampleFrame.data[i + 2] ?? 0;
        
        totalIntensity += (r + g + b);
      }
      
      intensityByPosition[x] = totalIntensity / (sampleFrame.height * 3);
    }
    
    // Find max for scaling
    const maxIntensity = Math.max(...intensityByPosition);
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, displayHeight - 20);
    ctx.lineTo(displayWidth, displayHeight - 20);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, displayHeight - 20);
    ctx.stroke();
    
    // X-axis labels (wavelength)
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // Add wavelength markers
    for (let wl = 400; wl <= 700; wl += 50) {
      const x = ((wl - 380) / (750 - 380)) * displayWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, displayHeight - 20);
      ctx.lineTo(x, displayHeight - 15);
      ctx.stroke();
      
      ctx.fillText(`${wl}nm`, x, displayHeight - 5);
    }
    
    // Draw the spectrum with improved rendering
    ctx.beginPath();
    
    // Set line style for better quality
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Scale the x-coordinates for better smooth rendering
    const scaleX = displayWidth / sampleFrame.width;
    
    // Start the path
    if (intensityByPosition[0] !== undefined) {
      const firstY = displayHeight - 20 - ((intensityByPosition[0] ?? 0) / maxIntensity) * (displayHeight - 30);
      ctx.moveTo(0, firstY);
    } else {
      ctx.moveTo(0, displayHeight - 20);
    }
    
    // Connect all points with a scaled approach
    for (let x = 1; x < intensityByPosition.length; x++) {
      if (intensityByPosition[x] !== undefined) {
        const y = displayHeight - 20 - ((intensityByPosition[x] ?? 0) / maxIntensity) * (displayHeight - 30);
        ctx.lineTo(x * scaleX, y);
      }
    }
    
    ctx.strokeStyle = "rgba(0, 200, 255, 0.8)";
    ctx.lineWidth = 2;
    
    // Add shadow for better visibility
    ctx.shadowColor = 'rgba(0, 200, 255, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.stroke();
    
    // Calculate absorbance if we have a reference frame
    if (referenceFrame && sampleFrame.width === referenceFrame.width && sampleFrame.height === referenceFrame.height) {
      calculateAbsorbance(referenceFrame, sampleFrame);
    }
    
  }, [sampleFrame, referenceFrame]);

  // Calculate absorbance
  const calculateAbsorbance = (reference: ImageData, sample: ImageData) => {
    if (!absorbanceCanvasRef.current) return;
    
    const canvas = absorbanceCanvasRef.current;
    const displayWidth = canvas.clientWidth;
    const displayHeight = 150;
    
    // Setup hi-DPI canvas to prevent pixelation
    const ctx = setupHiDPICanvas(canvas, displayWidth, displayHeight);
    if (!ctx) return;
    
    // Process the image data to create intensity arrays
    const referenceIntensity = Array(reference.width).fill(0) as number[];
    const sampleIntensity = Array(sample.width).fill(0) as number[];
    
    for (let x = 0; x < reference.width; x++) {
      let refTotal = 0;
      let sampleTotal = 0;
      
      for (let y = 0; y < reference.height; y++) {
        const i = (y * reference.width + x) * 4;
        
        // Reference intensity
        const rRef = reference.data[i] ?? 0;
        const gRef = reference.data[i + 1] ?? 0;
        const bRef = reference.data[i + 2] ?? 0;
        refTotal += (rRef + gRef + bRef);
        
        // Sample intensity
        const rSample = sample.data[i] ?? 0;
        const gSample = sample.data[i + 1] ?? 0;
        const bSample = sample.data[i + 2] ?? 0;
        sampleTotal += (rSample + gSample + bSample);
      }
      
      referenceIntensity[x] = refTotal / (reference.height * 3);
      sampleIntensity[x] = sampleTotal / (sample.height * 3);
    }
    
    // Calculate absorbance: A = -log10(I/I₀)
    // Where I is sample intensity and I₀ is reference intensity
    const absorbance = referenceIntensity.map((ref, index) => {
      // Avoid division by zero or negative values
      const sampleVal = sampleIntensity[index] ?? 0;
      const ratio = (sampleVal > 0 && ref > 0) ? sampleVal / ref : 1;
      return ratio > 0 ? -Math.log10(ratio) : 0;
    });
    
    // Create absorbance data for potential use elsewhere
    const newAbsorbanceData = absorbance.map((abs, index) => ({
      wavelength: pixelToWavelength(index, reference.width),
      absorbance: abs
    }));
    
    setAbsorbanceData(newAbsorbanceData);
    
    // Find max for scaling (but cap at 2 for better visualization)
    const maxAbsorbance = Math.min(2, Math.max(...absorbance));
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, displayHeight - 20);
    ctx.lineTo(displayWidth, displayHeight - 20);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, displayHeight - 20);
    ctx.stroke();
    
    // X-axis labels (wavelength)
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // Add wavelength markers
    for (let wl = 400; wl <= 700; wl += 50) {
      const x = ((wl - 380) / (750 - 380)) * displayWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, displayHeight - 20);
      ctx.lineTo(x, displayHeight - 15);
      ctx.stroke();
      
      ctx.fillText(`${wl}nm`, x, displayHeight - 5);
    }
    
    // Y-axis labels (absorbance)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888';
    for (let a = 0; a <= 1; a += 0.5) {
      const y = displayHeight - 20 - (a / maxAbsorbance) * (displayHeight - 30);
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(5, y);
      ctx.stroke();
      
      ctx.fillText(a.toFixed(1), 25, y + 4);
    }
    
    // Draw the absorbance spectrum with improved rendering
    ctx.beginPath();
    
    // Set line style for better quality
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Scale the x-coordinates for better smooth rendering
    const scaleX = displayWidth / reference.width;
    
    // Start the path
    if (absorbance[0] !== undefined) {
      const firstY = displayHeight - 20 - ((absorbance[0] ?? 0) / maxAbsorbance) * (displayHeight - 30);
      ctx.moveTo(0, firstY);
    } else {
      ctx.moveTo(0, displayHeight - 20);
    }
    
    // Connect all points with a scaled approach
    for (let x = 1; x < absorbance.length; x++) {
      if (absorbance[x] !== undefined) {
        const y = displayHeight - 20 - ((absorbance[x] ?? 0) / maxAbsorbance) * (displayHeight - 30);
        ctx.lineTo(x * scaleX, y);
      }
    }
    
    ctx.strokeStyle = "rgba(255, 80, 80, 0.8)";
    ctx.lineWidth = 2;
    
    // Add shadow for better visibility
    ctx.shadowColor = 'rgba(255, 80, 80, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.stroke();
  };

  return (
    <Card className="w-full border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Spectral Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="live">Live Spectrum</TabsTrigger>
            <TabsTrigger value="reference" disabled={!hasReference}>Reference</TabsTrigger>
            <TabsTrigger value="sample" disabled={!hasSample}>Sample</TabsTrigger>
            <TabsTrigger value="absorbance" disabled={!hasReference || !hasSample}>Absorbance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="live" className="mt-4">
            <div className="rounded-md overflow-hidden bg-black">
              <canvas ref={canvasRef} className="w-full" />
            </div>
            <div className="text-sm mt-2 text-neutral-400">
              This shows the current spectral data from the selection area in real-time.
            </div>
          </TabsContent>
          
          <TabsContent value="reference" className="mt-4">
            {hasReference ? (
              <div className="rounded-md overflow-hidden bg-black">
                <canvas ref={referenceCanvasRef} className="w-full" />
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No reference data available. Capture a reference frame first.
                </AlertDescription>
              </Alert>
            )}
            <div className="text-sm mt-2 text-neutral-400">
              Reference data represents your baseline measurement (empty or solvent-only).
            </div>
          </TabsContent>
          
          <TabsContent value="sample" className="mt-4">
            {hasSample ? (
              <div className="rounded-md overflow-hidden bg-black">
                <canvas ref={sampleCanvasRef} className="w-full" />
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No sample data available. Capture a sample frame first.
                </AlertDescription>
              </Alert>
            )}
            <div className="text-sm mt-2 text-neutral-400">
              Sample data shows the spectral pattern of your sample.
            </div>
          </TabsContent>
          
          <TabsContent value="absorbance" className="mt-4">
            {hasReference && hasSample ? (
              <div className="rounded-md overflow-hidden bg-black">
                <canvas ref={absorbanceCanvasRef} className="w-full" />
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Both reference and sample data are required to calculate absorbance.
                </AlertDescription>
              </Alert>
            )}
            <div className="text-sm mt-2 text-neutral-400">
              Absorbance (A) is calculated as -log10(Sample/Reference) and shows which wavelengths are absorbed by the sample.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 