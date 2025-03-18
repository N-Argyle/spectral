"use client";

import { useState, useEffect, useCallback } from "react";
import WebcamCapture from "~/components/WebcamCapture";
import SpectralAnalysis from "~/components/SpectralAnalysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Beaker, Download } from "lucide-react";
import { BlackoutStatus } from "~/components/spectral/BlackoutStatus";

export default function HomePage() {
  const [currentFrame, setCurrentFrame] = useState<ImageData | undefined>();
  const [referenceFrame, setReferenceFrame] = useState<ImageData | undefined>();
  const [sampleFrame, setSampleFrame] = useState<ImageData | undefined>();
  const [blackoutCalibrationData, setBlackoutCalibrationData] = useState<ImageData | null>(null);

  // Debug log for frame updates
  useEffect(() => {
    console.log("Current frame updated:", !!currentFrame);
  }, [currentFrame]);

  // Debug log for reference and sample frames
  useEffect(() => {
    console.log("Reference frame captured:", !!referenceFrame);
  }, [referenceFrame]);

  useEffect(() => {
    console.log("Sample frame captured:", !!sampleFrame);
  }, [sampleFrame]);

  // Debug log for blackout calibration data
  useEffect(() => {
    console.log("HomePage: blackoutCalibrationData changed:", 
      blackoutCalibrationData ? `${blackoutCalibrationData.width}x${blackoutCalibrationData.height}` : "null");
  }, [blackoutCalibrationData]);

  // Handle blackout calibration
  const handleBlackoutCalibrated = useCallback((imageData: ImageData) => {
    console.log("Blackout calibration received in parent");
    setBlackoutCalibrationData(imageData);
  }, []);

  // Handle frame capture from webcam
  const handleFrameCapture = useCallback((imageData: ImageData, blackoutData: ImageData | null) => {
    if (imageData && imageData.width > 0 && imageData.height > 0) {
      setCurrentFrame(imageData);
      
      // The blackoutData should come from the WebcamCapture component's blackoutCalibrationRef
      // Don't modify blackoutCalibrationData here, as that happens in handleBlackoutCalibrated
      // This prevents potential update loops between the components
    }
  }, []); // Empty dependency array ensures this doesn't change with other state changes

  const downloadSpectralData = () => {
    if (!referenceFrame || !sampleFrame) return;
    
    // Create arrays of intensity values
    const referenceData: number[] = [];
    const sampleData: number[] = [];
    const absorbanceData: number[] = [];
    const wavelengths: number[] = [];
    
    // Process each column (wavelength position)
    for (let x = 0; x < referenceFrame.width; x++) {
      let refTotal = 0;
      let sampleTotal = 0;
      
      // Sum intensities for each column
      for (let y = 0; y < referenceFrame.height; y++) {
        const i = (y * referenceFrame.width + x) * 4;
        
        // Reference values
        const rRef = referenceFrame.data[i] ?? 0;
        const gRef = referenceFrame.data[i + 1] ?? 0;
        const bRef = referenceFrame.data[i + 2] ?? 0;
        refTotal += (rRef + gRef + bRef);
        
        // Sample values
        const rSample = sampleFrame.data[i] ?? 0;
        const gSample = sampleFrame.data[i + 1] ?? 0;
        const bSample = sampleFrame.data[i + 2] ?? 0;
        sampleTotal += (rSample + gSample + bSample);
      }
      
      // Calculate average intensity
      const refIntensity = refTotal / (referenceFrame.height * 3);
      const sampleIntensity = sampleTotal / (sampleFrame.height * 3);
      
      // Calculate absorbance: A = -log10(I/I₀)
      const ratio = sampleIntensity > 0 && refIntensity > 0 ? sampleIntensity / refIntensity : 1;
      const absorbance = ratio > 0 ? -Math.log10(ratio) : 0;
      
      // Calculate approximate wavelength
      const wavelength = Math.round(380 + (x / referenceFrame.width) * (750 - 380));
      
      // Store data
      referenceData.push(refIntensity);
      sampleData.push(sampleIntensity);
      absorbanceData.push(absorbance);
      wavelengths.push(wavelength);
    }
    
    // Create CSV content
    let csvContent = 'Wavelength (nm),Reference Intensity,Sample Intensity,Absorbance\n';
    for (let i = 0; i < wavelengths.length; i++) {
      csvContent += `${wavelengths[i]},${referenceData[i].toFixed(2)},${sampleData[i].toFixed(2)},${absorbanceData[i].toFixed(4)}\n`;
    }
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "spectral_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="container p-4 md:p-6 flex flex-col mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Beaker className="h-8 w-8" />
            Spectral Web
          </h1>
          <p className="text-muted-foreground">Web-based spectrophotometer for chemical analysis</p>
        </header>
        
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div>
            <WebcamCapture 
              onFrameCapture={handleFrameCapture}
              onReferenceCaptured={setReferenceFrame}
              onSampleCaptured={setSampleFrame}
              onBlackoutCalibrated={handleBlackoutCalibrated}
            />
          </div>
          
          <div>
            <SpectralAnalysis 
              currentFrame={currentFrame}
              referenceFrame={referenceFrame}
              sampleFrame={sampleFrame}
              blackoutCalibrationData={blackoutCalibrationData}
            />
          </div>
          
          <div >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Experiment Information</CardTitle>
                <CardDescription>Documentation and data export</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-lg font-medium mb-2">How to use:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Place an empty cuvet (or solvent reference) in front of the light source</li>
                      <li>Adjust the selection box to capture the spectrum</li>
                      <li>Click "Capture Reference" to record baseline</li>
                      <li>Replace with your sample cuvet</li>
                      <li>Click "Capture Sample" to record sample spectrum</li>
                      <li>View the absorbance tab to see results</li>
                      <li>Download data for further analysis</li>
                    </ol>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-2">Notes:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Wavelength values are approximate</li>
                      <li>For best results, use a dark environment</li>
                      <li>Keep camera and setup stable between measurements</li>
                      <li>Consider averaging multiple measurements for precision</li>
                    </ul>
                    
                    <div className="mt-4 mb-4">
                      <h4 className="font-medium mb-1">Calibration Status:</h4>
                      <BlackoutStatus blackoutCalibrationData={blackoutCalibrationData} />
                    </div>
                    
                    <div className="mt-6">
                      <Button
                        onClick={downloadSpectralData}
                        disabled={!referenceFrame || !sampleFrame}
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Spectral Data
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <footer className="mt-auto border-t py-4">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Spectral Web - A browser-based spectrophotometer application</p>
        </div>
      </footer>
    </main>
  );
}
