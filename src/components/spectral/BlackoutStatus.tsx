"use client";

import { useEffect, useState, useRef } from "react";

interface BlackoutStatusProps {
  blackoutCalibrationData: ImageData | null;
}

export function BlackoutStatus({ blackoutCalibrationData }: BlackoutStatusProps) {
  const [averageValues, setAverageValues] = useState<{ r: number; g: number; b: number } | null>(null);
  const [calibrationQuality, setCalibrationQuality] = useState<'good' | 'medium' | 'poor' | null>(null);
  const lastCalibrationDataRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Generate a unique key for this calibration data
    const calibKey = blackoutCalibrationData 
      ? `${blackoutCalibrationData.width}x${blackoutCalibrationData.height}`
      : null;
      
    // Skip if this is the same calibration data we've already processed
    if (calibKey === lastCalibrationDataRef.current) {
      return;
    }
    
    // Update the ref with the current key
    lastCalibrationDataRef.current = calibKey;
    
    console.log("BlackoutStatus received data:", blackoutCalibrationData ? calibKey : "null");
    
    if (!blackoutCalibrationData) {
      setAverageValues(null);
      setCalibrationQuality(null);
      return;
    }
    
    // Calculate average RGB values
    const totalPixels = blackoutCalibrationData.width * blackoutCalibrationData.height;
    let sumR = 0, sumG = 0, sumB = 0;
    
    for (let i = 0; i < blackoutCalibrationData.data.length; i += 4) {
      sumR += blackoutCalibrationData.data[i] ?? 0;
      sumG += blackoutCalibrationData.data[i + 1] ?? 0;
      sumB += blackoutCalibrationData.data[i + 2] ?? 0;
    }
    
    const avgR = Math.round(sumR / totalPixels);
    const avgG = Math.round(sumG / totalPixels);
    const avgB = Math.round(sumB / totalPixels);
    
    setAverageValues({
      r: avgR,
      g: avgG,
      b: avgB
    });
    
    // Evaluate calibration quality based on noise levels
    const totalNoise = avgR + avgG + avgB;
    if (totalNoise < 30) {
      setCalibrationQuality('good');
    } else if (totalNoise < 75) {
      setCalibrationQuality('medium');
    } else {
      setCalibrationQuality('poor');
    }
  }, [blackoutCalibrationData]);
  
  if (!blackoutCalibrationData) {
    return (
      <div className="text-yellow-400 text-sm p-2 bg-yellow-900/20 rounded-md flex flex-col gap-1">
        <p className="font-medium">No blackout calibration data</p>
        <p className="text-xs">Cover your camera or light source completely and click &quot;Calibrate Blackout&quot; to improve measurement accuracy by compensating for camera noise.</p>
      </div>
    );
  }
  
  return (
    <div className={`text-sm p-2 rounded-md flex flex-col gap-1
      ${calibrationQuality === 'good' ? 'bg-green-900/20 text-green-400' : 
        calibrationQuality === 'medium' ? 'bg-yellow-900/20 text-yellow-400' : 
        'bg-red-900/20 text-red-400'}`}>
      <p className="font-medium flex items-center">
        <span className={`inline-block w-2 h-2 rounded-full mr-2
          ${calibrationQuality === 'good' ? 'bg-green-400' : 
            calibrationQuality === 'medium' ? 'bg-yellow-400' : 
            'bg-red-400'}`}>
        </span>
        Blackout calibration: {calibrationQuality === 'good' ? 'Good' : 
          calibrationQuality === 'medium' ? 'Fair' : 'Poor'}
      </p>
      
      {averageValues && (
        <div className="mt-1 text-xs">
          <div className="flex justify-between items-center">
            <span>Noise values: RGB({averageValues.r}, {averageValues.g}, {averageValues.b})</span>
            <span className="text-[10px] opacity-70">
              {calibrationQuality === 'good' ? '✓ Low noise' : 
                calibrationQuality === 'medium' ? '⚠️ Moderate noise' : 
                '⚠️ High noise'}
            </span>
          </div>
          <div className="mt-1 w-full h-4 bg-black/50 rounded overflow-hidden flex">
            <div 
              className="h-full bg-red-600" 
              style={{ width: `${Math.min(100, (averageValues.r / 255) * 100 * 3)}%` }}
              title={`Red: ${averageValues.r}`}
            />
            <div 
              className="h-full bg-green-600" 
              style={{ width: `${Math.min(100, (averageValues.g / 255) * 100 * 3)}%` }}
              title={`Green: ${averageValues.g}`}
            />
            <div 
              className="h-full bg-blue-600" 
              style={{ width: `${Math.min(100, (averageValues.b / 255) * 100 * 3)}%` }}
              title={`Blue: ${averageValues.b}`}
            />
          </div>
          
          {calibrationQuality !== 'good' && (
            <p className="mt-2 text-[10px] opacity-80">
              For better results, ensure complete darkness when calibrating. Try covering the camera completely or calibrating in a darker environment.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 