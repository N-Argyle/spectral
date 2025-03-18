/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useRef, useEffect, useCallback } from "react";

interface SpectralCanvasProps {
  className?: string;
  onCanvasReady?: (
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => void;
  height?: number;
}

export function SpectralCanvas({
  className = "",
  onCanvasReady,
  height = 150,
}: SpectralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onCanvasReady);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dimensionsRef = useRef({ width: 0, height });
  const setupDoneRef = useRef(false);
  
  // Update the callback ref when the prop changes
  useEffect(() => {
    // Update the callback reference
    callbackRef.current = onCanvasReady;
    
    // If we have a context and the callback has changed, trigger a redraw
    if (ctxRef.current && setupDoneRef.current && callbackRef.current) {
      callbackRef.current(
        ctxRef.current, 
        dimensionsRef.current.width, 
        dimensionsRef.current.height
      );
    }
  }, [onCanvasReady]);

  // Force a redraw when height changes
  useEffect(() => {
    dimensionsRef.current.height = height;
    if (setupDoneRef.current && canvasRef.current && callbackRef.current && ctxRef.current) {
      // Recalculate dimensions and redraw
      setupDoneRef.current = false; // Force setup to run again
      setupCanvas();
    }
  }, [height]);

  // Setup the canvas with dimensions and context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const displayWidth = canvas.clientWidth;
    const displayHeight = height;
    
    // Only reconfigure if dimensions changed or setup not done
    if (dimensionsRef.current.width !== displayWidth || 
        dimensionsRef.current.height !== displayHeight ||
        !setupDoneRef.current) {
      
      // Store the dimensions for later use
      dimensionsRef.current = { width: displayWidth, height: displayHeight };
      
      // Setup hi-DPI canvas
      const ctx = setupHiDPICanvas(canvas, displayWidth, displayHeight);
      if (!ctx) return;
      
      // Store the context for later use
      ctxRef.current = ctx;
      setupDoneRef.current = true;
      
      console.log("Canvas setup complete:", displayWidth, "x", displayHeight);
      
      // Call the callback if available
      if (callbackRef.current) {
        try {
          callbackRef.current(ctx, displayWidth, displayHeight);
        } catch (error) {
          console.error("Error in canvas callback:", error);
        }
      }
    }
  }, [height]);

  // Set up the canvas when it's mounted and when the height changes
  useEffect(() => {
    // Try initial setup
    setupCanvas();
    
    // Also set up canvas on window resize to handle responsive behavior
    const handleResize = () => {
      setupCanvas();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Try another setup after a short delay to ensure proper dimensions
    const setupTimer = setTimeout(() => {
      if (canvasRef.current && !setupDoneRef.current) {
        console.log("Retrying canvas setup...");
        setupCanvas();
      }
    }, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(setupTimer);
    };
  }, [setupCanvas]);

  return <canvas ref={canvasRef} className={className} />;
}

// Setup canvas with proper device pixel ratio to prevent pixelation
export function setupHiDPICanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  if (width <= 0 || height <= 0) {
    console.warn("Invalid canvas dimensions:", width, "x", height);
    return null;
  }

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
  if (!ctx) {
    console.error("Failed to get canvas context");
    return null;
  }
  
  ctx.scale(dpr, dpr);
  
  // Enable higher quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  return ctx;
} 