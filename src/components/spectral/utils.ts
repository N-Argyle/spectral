/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Industry-standard utilities for spectral analysis from RGB images
 */

/**
 * Convert wavelength (nm) to approximate RGB values using CIE 1931 color matching functions
 */
function wavelengthToRGB(wavelength: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    b = 1.0;
  } else if (wavelength >= 440 && wavelength < 490) {
    g = (wavelength - 440) / (490 - 440);
    b = 1.0;
  } else if (wavelength >= 490 && wavelength < 510) {
    g = 1.0;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1.0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1.0;
    g = -(wavelength - 645) / (645 - 580);
  } else if (wavelength >= 645 && wavelength <= 750) {
    r = 1.0;
  }

  const factor = wavelength < 420 ? 0.3 + 0.7 * (wavelength - 380) / (420 - 380) :
                wavelength > 700 ? 0.3 + 0.7 * (750 - wavelength) / (750 - 700) : 1.0;

  return [r * factor, g * factor, b * factor];
}


// Constants for spectral processing
export const SPECTRUM_RESOLUTION = 100;

/**
 * Process image data to extract spectral information
 * This function separates RGB channels and combines them to create a wavelength-specific intensity profile
 */
export function processImageData(
  imageData: ImageData,
  blackoutCalibrationData?: ImageData
): number[] {
  // Skip processing if we don't have imageData
  if (!imageData?.data) {
    console.warn('No image data available to process');
    return Array(SPECTRUM_RESOLUTION).fill(0) as number[];
  }

  // Create arrays for each channel's intensity profile
  // Using typed arrays to ensure type safety
  const redIntensities: number[] = Array(SPECTRUM_RESOLUTION).fill(0);
  const greenIntensities: number[] = Array(SPECTRUM_RESOLUTION).fill(0);
  const blueIntensities: number[] = Array(SPECTRUM_RESOLUTION).fill(0);
  const counts: number[] = Array(SPECTRUM_RESOLUTION).fill(0);

  const { width, height, data } = imageData;
  const blackoutData = blackoutCalibrationData?.data;

  // For each pixel, extract R, G, B values and add to the appropriate bin
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      // Get RGB values with definite assignment
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      
      // Skip very dark pixels (likely noise)
      if (r + g + b < 30) continue;
      
      // Handle blackout calibration data with null coalescing
      let noiseR = 0, noiseG = 0, noiseB = 0;
      if (blackoutData) {
        noiseR = blackoutData[i] ?? 0;
        noiseG = blackoutData[i + 1] ?? 0;
        noiseB = blackoutData[i + 2] ?? 0;
      }
      
      // Calculate adjusted values (prevent negatives)
      // Increase green channel subtraction to reduce excess green intensity
      const adjR = Math.max(0, r - (noiseR * 0.95));
      const adjG = Math.max(0, g - (noiseG * 1.05)); // Increased subtraction for green
      const adjB = Math.max(0, b - (noiseB * 0.95));
      
      // Map the x position to a wavelength index (assuming linear mapping)
      const xRatio = x / width;
      const spectrumIndex = Math.floor(xRatio * SPECTRUM_RESOLUTION);
      
      if (spectrumIndex >= 0 && spectrumIndex < SPECTRUM_RESOLUTION) {
        // Arrays are initialized with the correct size, so index access is safe
        redIntensities[spectrumIndex] = (redIntensities[spectrumIndex] ?? 0) + adjR;
        greenIntensities[spectrumIndex] = (greenIntensities[spectrumIndex] ?? 0) + adjG;
        blueIntensities[spectrumIndex] = (blueIntensities[spectrumIndex] ?? 0) + adjB;
        counts[spectrumIndex] = (counts[spectrumIndex] ?? 0) + 1;
      }
    }
  }

  // Calculate weighted intensity for each wavelength
  const intensities: number[] = Array(SPECTRUM_RESOLUTION).fill(0);
  
  for (let i = 0; i < SPECTRUM_RESOLUTION; i++) {
    if ((counts[i] ?? 0) > 0) {
      // Normalize by count - using non-null assertion since we know arrays are initialized and index is in range
      const avgR = redIntensities[i]! / counts[i]!;
      const avgG = greenIntensities[i]! / counts[i]!;
      const avgB = blueIntensities[i]! / counts[i]!;
      
      // Map spectrum index to approx wavelength (380-750nm)
      const wavelength = 380 + (i / SPECTRUM_RESOLUTION) * (750 - 380);
      
      // Weights based on typical camera sensor response curves (approximated)
      let redWeight = 0, greenWeight = 0, blueWeight = 0;
      
      // Adjusted weights to reduce green dominance
      if (wavelength < 490) { // Blue region
        blueWeight = 1.0;
        greenWeight = 0.2;  // Reduced from 0.3
        redWeight = 0.0;
      } else if (wavelength < 580) { // Green region
        blueWeight = 0.2;
        greenWeight = 0.7;  // Reduced from 1.0
        redWeight = 0.2;
      } else { // Red region
        blueWeight = 0.0;
        greenWeight = 0.2;  // Reduced from 0.3
        redWeight = 0.8;
      }
      
      // Calculate weighted intensity with adjusted scaling
      intensities[i] = (avgR * redWeight + avgG * greenWeight + avgB * blueWeight);
    }
  }
  
  // Apply smoothing with a gaussian kernel to reduce noise
  const smoothedIntensities: number[] = Array(SPECTRUM_RESOLUTION).fill(0);
  const kernelSize = 5;
  const sigma = 1.0;
  const kernel = createGaussianKernel(kernelSize, sigma);
  
  for (let i = 0; i < SPECTRUM_RESOLUTION; i++) {
    let sum = 0;
    let weightSum = 0;
    
    for (let k = -Math.floor(kernelSize/2); k <= Math.floor(kernelSize/2); k++) {
      const index = i + k;
      if (index >= 0 && index < SPECTRUM_RESOLUTION) {
        const kernelIndex = k + Math.floor(kernelSize/2);
        if (kernelIndex >= 0 && kernelIndex < kernel.length) {
          const kernelValue = kernel[kernelIndex]!;
          sum += intensities[index]! * kernelValue;
          weightSum += kernelValue;
        }
      }
    }
    
    smoothedIntensities[i] = weightSum > 0 ? sum / weightSum : 0;
  }
  
  return smoothedIntensities;
}

/**
 * Apply Gaussian smoothing to spectrum data
 */
function smoothSpectrum(data: number[], sigma = 2): number[] {
  const result: number[] = Array(data.length).fill(0);
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[] = [];
  
  for (let i = -(kernelSize - 1) / 2; i <= (kernelSize - 1) / 2; i++) {
    kernel.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  }

  const halfKernel = Math.floor(kernel.length / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0, weight = 0;
    
    for (let j = 0; j < kernel.length; j++) {
      const idx = i + j - halfKernel;
      if (idx >= 0 && idx < data.length) {
        // Get values safely
        const dataValue = data[idx] ?? 0;
        const kernelValue = kernel[j] ?? 0;
        
        // Both are defined because we checked the indices
        sum += dataValue * kernelValue;
        weight += kernelValue;
      }
    }
    
    result[i] = weight > 0 ? sum / weight : 0;
  }
  
  return result;
}

/**
 * Draw axes and labels for the spectral graph
 */
export function drawAxes(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, height - 20);
  ctx.lineTo(width - 20, height - 20);
  ctx.moveTo(20, 20);
  ctx.lineTo(20, height - 20);
  ctx.stroke();

  ctx.fillStyle = '#999';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  for (let wl = 400; wl <= 700; wl += 100) {
    const x = 20 + ((wl - 380) / (750 - 380)) * (width - 40);
    ctx.fillText(`${wl}nm`, x, height - 5);
  }
}

/**
 * Draw spectral line visualization
 */
export function drawSpectralLine(
  ctx: CanvasRenderingContext2D,
  data: number[],
  width: number,
  height: number,
  style: string | CanvasGradient,
  shadowColor = 'rgba(0, 0, 0, 0.5)',
  intensityMultiplier = 2.0
): void {
  // Apply additional smoothing for better visualization
  const smoothedData = smoothSpectrum(data, 1.5);
  
  // Safely filter out invalid values
  const validValues = smoothedData.filter(v => 
    typeof v === 'number' && !isNaN(v)
  );
  
  // Set a fixed max value for a more stable display
  // If data is already normalized (0-1), this will be 1.0
  // Otherwise, use the 95th percentile to avoid outliers
  let maxVal = 0.1; // Minimum threshold

  if (validValues.length > 0) {
    // Check if data looks normalized (most values <= 1.0)
    const normalizedDataCount = validValues.filter(v => v <= 1.0).length;
    const dataAppearsNormalized = normalizedDataCount > validValues.length * 0.9;
    
    if (dataAppearsNormalized) {
      // For normalized data, use a fixed scale with maximum of 1.0
      maxVal = 1.0;
      console.log("Using normalized scale (0-1)");
    } else {
      // For raw data, use a percentile approach to avoid outliers
      const sortedValues = [...validValues].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedValues.length * 0.95);
      // Use null coalescing to provide a fallback
      const p95Value = sortedValues[p95Index] ?? sortedValues[sortedValues.length - 1] ?? 0.1;
      maxVal = Math.max(p95Value, 0.1);
      console.log("Using percentile scale, max:", maxVal);
    }
  }

  // Begin path for drawing the spectrum line
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Calculate x-scale based on data length
  const xScale = (width - 40) / Math.max(1, data.length - 1);
  const points: Array<[number, number]> = [];
  
  // First collect all valid points
  for (let i = 0; i < smoothedData.length; i++) {
    const value = smoothedData[i];
    if (typeof value !== 'number' || isNaN(value)) continue;
    
    // Ensure value is clamped between 0 and maxVal
    const clampedValue = Math.max(0, Math.min(value, maxVal));
    
    // Convert to a 0-1 scale for consistent display
    const normalizedValue = clampedValue / maxVal;
    
    // Calculate x and y coordinates
    const x = 20 + i * xScale;
    
    // Height calculations: 
    // - Start at bottom (height - 20)
    // - Move up based on normalized value
    // - Apply intensity multiplier
    // - Scale by available height (height - 60)
    const y = height - 20 - (normalizedValue * intensityMultiplier) * (height - 60);
    
    // Ensure y is within chart boundaries (with a small buffer)
    const safeY = Math.max(20, Math.min(height - 20, y));
    
    if (points) points.push([x, safeY]);
  }
  
  // Now draw using the points
  if (points && points.length > 0 && points[0]) {
    // Move to the first point
    const firstPoint = points[0];
    if (firstPoint && typeof firstPoint[0] === 'number' && typeof firstPoint[1] === 'number') {
      ctx.moveTo(firstPoint[0], firstPoint[1]);
      
      // For all data sets, draw straight lines (simpler and more reliable)
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point && typeof point[0] === 'number' && typeof point[1] === 'number') {
          ctx.lineTo(point[0], point[1]);
        }
      }
    }
  }

  // Apply shadow for better visibility
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Set stroke style and line width
  ctx.strokeStyle = style;
  ctx.lineWidth = 2;
  
  // Draw the path (just the line, not filled yet)
  ctx.stroke();
  
  // Reset shadow settings
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  ctx.closePath();
}

/**
 * Draw complete spectral visualization
 */
export function drawSpectrum(ctx: CanvasRenderingContext2D, data: number[], width: number, height: number): void {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);
  drawAxes(ctx, width, height);

  const gradient = ctx.createLinearGradient(20, 0, width - 20, 0);
  for (let wl = 380; wl <= 750; wl += 10) {
    const [r, g, b] = wavelengthToRGB(wl);
    const stop = (wl - 380) / (750 - 380);
    gradient.addColorStop(stop, `rgb(${r * 255},${g * 255},${b * 255})`);
  }

  drawSpectralLine(ctx, data, width, height, gradient);
}

/**
 * Calculate absorbance spectrum
 */
export function calculateAbsorbance(
  referenceData: number[],
  sampleData: number[]
): number[] {
  if (!referenceData || !sampleData || referenceData.length !== sampleData.length) {
    console.warn('Invalid data for absorbance calculation');
    return Array(SPECTRUM_RESOLUTION).fill(0) as number[];
  }

  return referenceData.map((r, index) => {
    // Safely access sampleData with a default of 0 for undefined values
    const s = sampleData[index] ?? 0;
    
    // Skip calculation if we have invalid values
    if (r <= 0 || s <= 0) return 0;
    
    // Calculate wavelength for this index
    const wavelength = 380 + (index / SPECTRUM_RESOLUTION) * (750 - 380);
    
    // Apply wavelength-specific corrections
    let correction = 1.0;
    
    // Reduce sensitivity in the red region (600-700nm) to compensate for potential over-sensitivity
    if (wavelength > 600 && wavelength < 700) {
      // Apply a gradual reduction factor based on how far into the red region we are
      // Maximum correction at 650nm (center of the red peak)
      const distFromCenter = Math.abs(wavelength - 650);
      const maxCorrection = 0.7; // At most reduce the absorbance by 30%
      
      if (distFromCenter < 50) {
        correction = 1.0 - maxCorrection * (1 - distFromCenter / 50);
      }
    }
    
    // Calculate absorbance: -log10(Sample/Reference)
    // We take the absolute value to ensure all values are positive for the 0-1 scale display
    const absorbance = Math.abs(-Math.log10(r / s) * correction);
    
    // Clamp to reasonable range for display (0-1)
    return Math.min(1, absorbance);
  });
}

/**
 * Check browser capabilities for camera APIs
 * Returns an object with boolean flags for each capability
 */
export function checkBrowserCapabilities(): { focusModeSupported: boolean } {
  const capabilities = {
    focusModeSupported: false
  };
  
  // Check if mediaDevices API is supported
  if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
    // Check for focus mode support
    if (navigator.mediaDevices.getSupportedConstraints) {
      const constraints = navigator.mediaDevices.getSupportedConstraints();
      capabilities.focusModeSupported = constraints.focusMode ?? false;
    }
  }
  
  return capabilities;
}

/**
 * Create a rainbow gradient for spectrum visualization
 */
export function createSpectrumGradient(ctx: CanvasRenderingContext2D, width: number): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  for (let wl = 380; wl <= 750; wl += 10) {
    const [r, g, b] = wavelengthToRGB(wl);
    const position = (wl - 380) / (750 - 380);
    gradient.addColorStop(position, `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`);
  }
  return gradient;
}

/**
 * Convert pixel position to wavelength
 */
export function pixelToWavelength(pixelPos: number, totalBins: number): number {
  const minWavelength = 380;
  const maxWavelength = 750;
  return Math.round(minWavelength + (pixelPos / (totalBins - 1)) * (maxWavelength - minWavelength));
}

export function createGaussianKernel(size: number, sigma: number): number[] {
  const kernel: number[] = [];
  const mean = Math.floor(size / 2);
  
  for (let i = 0; i < size; i++) {
    const x = i - mean;
    kernel.push(Math.exp(-(x * x) / (2 * sigma * sigma)));
  }
  
  // Normalize
  const sum = kernel.reduce((a, b) => a + b, 0);
  return kernel.map(k => k / sum);
}

/**
 * Draw enhanced axes and grid for the spectral graph
 * Includes grid lines and y-axis values
 */
export function drawEnhancedAxes(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  maxIntensity = 100
): void {
  // Define margins for the graph
  const margin = {
    left: 45,  // Increased left margin for y-axis labels
    right: 20,
    top: 20,
    bottom: 30  // Increased bottom margin for x-axis labels
  };

  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;
  
  // Draw main axes
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  // x-axis
  ctx.moveTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  
  // y-axis
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.stroke();

  // Draw grid lines and labels
  ctx.lineWidth = 0.5;
  
  // Vertical grid lines (wavelength)
  ctx.strokeStyle = 'rgba(102, 102, 102, 0.3)';
  ctx.textAlign = 'center';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#999';
  
  for (let wl = 400; wl <= 700; wl += 50) {
    const x = margin.left + ((wl - 380) / (750 - 380)) * graphWidth;
    
    // Grid line
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, height - margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label
    ctx.fillText(`${wl}nm`, x, height - margin.bottom + 15);
  }
  
  // Horizontal grid lines (intensity)
  const ySteps = 5; // Number of horizontal grid lines
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= ySteps; i++) {
    const y = height - margin.bottom - (i / ySteps) * graphHeight;
    const intensity = Math.round((i / ySteps) * maxIntensity);
    
    // Grid line
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label
    ctx.fillText(`${intensity}`, margin.left - 5, y + 4);
  }
  
  // Y-axis label
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Intensity', 0, 0);
  ctx.restore();
}

/**
 * Draw spectral line with enhanced visualization
 * Supports grid and improved visualization
 */
export function drawEnhancedSpectralLine(
  ctx: CanvasRenderingContext2D,
  data: number[],
  width: number,
  height: number,
  style: string | CanvasGradient,
  shadowColor = 'rgba(0, 0, 0, 0.5)',
  intensityMultiplier = 1.0
): void {
  // Define margins for the graph (must match those in drawEnhancedAxes)
  const margin = {
    left: 45,
    right: 20,
    top: 20,
    bottom: 30
  };

  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;
  
  // Apply additional smoothing for better visualization
  const smoothedData = smoothSpectrum(data, 1.5);
  
  // Safely filter out invalid values
  const validValues = smoothedData.filter(v => 
    typeof v === 'number' && !isNaN(v)
  );
  
  // Set a fixed max value for a more stable display
  let maxVal = 0.1; // Minimum threshold

  if (validValues.length > 0) {
    // Check if data looks normalized (most values <= 1.0)
    const normalizedDataCount = validValues.filter(v => v <= 1.0).length;
    const dataAppearsNormalized = normalizedDataCount > validValues.length * 0.9;
    
    if (dataAppearsNormalized) {
      // For normalized data, use a fixed scale with maximum of 1.0
      maxVal = 1.0;
    } else {
      // For raw data, use a percentile approach to avoid outliers
      const sortedValues = [...validValues].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedValues.length * 0.95);
      const p95Value = sortedValues[p95Index] ?? sortedValues[sortedValues.length - 1] ?? 0.1;
      maxVal = Math.max(p95Value, 0.1);
    }
  }

  // Begin path for drawing the spectrum line
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Calculate x-scale based on data length and graph width
  const xScale = graphWidth / Math.max(1, data.length - 1);
  const points: Array<[number, number]> = [];
  
  // First collect all valid points
  for (let i = 0; i < smoothedData.length; i++) {
    const value = smoothedData[i];
    if (typeof value !== 'number' || isNaN(value)) continue;
    
    // Ensure value is clamped between 0 and maxVal
    const clampedValue = Math.max(0, Math.min(value, maxVal));
    
    // Convert to a 0-1 scale for consistent display
    const normalizedValue = clampedValue / maxVal;
    
    // Calculate x and y coordinates
    const x = margin.left + i * xScale;
    
    // Height calculations adjusted for margins
    const y = height - margin.bottom - (normalizedValue * intensityMultiplier) * graphHeight;
    
    // Ensure y is within chart boundaries (with a small buffer)
    const safeY = Math.max(margin.top, Math.min(height - margin.bottom, y));
    
    if (points) points.push([x, safeY]);
  }
  
  // Now draw using the points
  if (points && points.length > 0 && points[0]) {
    // Move to the first point
    const firstPoint = points[0];
    if (firstPoint && typeof firstPoint[0] === 'number' && typeof firstPoint[1] === 'number') {
      ctx.moveTo(firstPoint[0], firstPoint[1]);
      
      // Draw straight lines
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point && typeof point[0] === 'number' && typeof point[1] === 'number') {
          ctx.lineTo(point[0], point[1]);
        }
      }
    }
  }

  // Apply shadow for better visibility
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Set stroke style and line width
  ctx.strokeStyle = style;
  ctx.lineWidth = 2;
  
  // Draw the path
  ctx.stroke();
  
  // Reset shadow settings
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  ctx.closePath();
}

/**
 * Draw enhanced spectrum visualization with grid
 */
export function drawEnhancedSpectrum(ctx: CanvasRenderingContext2D, data: number[], width: number, height: number): void {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);
  drawEnhancedAxes(ctx, width, height);

  const gradient = ctx.createLinearGradient(20, 0, width - 20, 0);
  for (let wl = 380; wl <= 750; wl += 10) {
    const [r, g, b] = wavelengthToRGB(wl);
    const stop = (wl - 380) / (750 - 380);
    gradient.addColorStop(stop, `rgb(${r * 255},${g * 255},${b * 255})`);
  }

  drawEnhancedSpectralLine(ctx, data, width, height, gradient);
}