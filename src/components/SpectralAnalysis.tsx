"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";

// Import the new modular components
import LiveSpectrum from "./spectral/LiveSpectrum";
import { ReferenceSpectrum } from "./spectral/ReferenceSpectrum";
import { SampleSpectrum } from "./spectral/SampleSpectrum";
import { AbsorbanceSpectrum } from "./spectral/AbsorbanceSpectrum";

interface SpectralAnalysisProps {
  currentFrame?: ImageData;
  referenceFrame?: ImageData;
  sampleFrame?: ImageData;
  blackoutCalibrationData?: ImageData | null;
}

export default function SpectralAnalysis({
  currentFrame,
  referenceFrame,
  sampleFrame,
  blackoutCalibrationData,
}: SpectralAnalysisProps) {
  const [activeTab, setActiveTab] = useState("live");
  const [hasReference, setHasReference] = useState(false);
  const [hasSample, setHasSample] = useState(false);
  const [spectrumData, setSpectrumData] = useState<{ wavelength: number, intensity: number }[]>([]);
  const [absorbanceData, setAbsorbanceData] = useState<{ wavelength: number, absorbance: number }[]>([]);

  // Check for reference and sample frames directly
  useEffect(() => {
    if (referenceFrame) {
      setHasReference(true);
    }
  }, [referenceFrame]);

  useEffect(() => {
    if (sampleFrame) {
      setHasSample(true);
    }
  }, [sampleFrame]);

  // Handlers for receiving processed data from child components
  const previousSpectrumDataRef = useRef<string>('');
  
  const handleSpectrumDataProcessed = useCallback((data: { wavelength: number, intensity: number }[]) => {
    const dataString = JSON.stringify(data);
    
    // Skip update if data hasn't changed
    if (dataString === previousSpectrumDataRef.current) {
      return;
    }
    
    previousSpectrumDataRef.current = dataString;
    setSpectrumData(data);
  }, []);

  const previousAbsorbanceDataRef = useRef<string>('');
  
  const handleAbsorbanceDataProcessed = useCallback((data: { wavelength: number, absorbance: number }[]) => {
    const dataString = JSON.stringify(data);
    
    // Skip update if data hasn't changed
    if (dataString === previousAbsorbanceDataRef.current) {
      return;
    }
    
    previousAbsorbanceDataRef.current = dataString;
    setAbsorbanceData(data);
  }, []);

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
            {currentFrame ? (
              <LiveSpectrum 
                currentFrame={currentFrame}
                blackoutCalibrationData={blackoutCalibrationData}
                onDataProcessed={handleSpectrumDataProcessed}
              />
            ) : (
              <Alert>
                <AlertDescription>
                  Waiting for webcam feed... Please make sure the webcam is properly connected and permissions are granted.
                </AlertDescription>
              </Alert>
            )}
            <div className="text-sm mt-2 text-neutral-400">
              This shows the current spectral data from the selection area in real-time.
              {blackoutCalibrationData && (
                <span className="text-green-400 font-medium ml-1">Black-level calibration applied.</span>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="reference" className="mt-4">
            {hasReference ? (
              <ReferenceSpectrum 
                referenceFrame={referenceFrame}
              />
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
              <SampleSpectrum 
                sampleFrame={sampleFrame}
              />
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
              <AbsorbanceSpectrum 
                referenceFrame={referenceFrame} 
                sampleFrame={sampleFrame}
                onDataProcessed={handleAbsorbanceDataProcessed}
              />
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