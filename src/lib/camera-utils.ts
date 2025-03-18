/**
 * Camera utility functions for the spectral analysis application
 * Client-side only utilities
 */

// Extend MediaTrackSupportedConstraints interface to include camera settings
declare global {
  // Define MediaSettingsRange for camera capabilities
  interface MediaSettingsRange {
    max: number;
    min: number;
    step: number;
  }

  interface MediaTrackSupportedConstraints {
    focusMode?: boolean;
    focusDistance?: boolean;
    whiteBalanceMode?: boolean;
    exposureMode?: boolean;
  }
  
  interface MediaTrackConstraints {
    focusMode?: string;
    focusDistance?: number;
    whiteBalanceMode?: string;
    exposureMode?: string;
  }
  
  interface MediaTrackCapabilities {
    focusMode?: string[];
    focusDistance?: MediaSettingsRange;
    whiteBalanceMode?: string[];
    exposureMode?: string[];
  }
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
 * Display browser capability information to the user
 * @param showAlerts Whether to show alert messages for unsupported features
 */
export function checkAndShowCapabilities(showAlerts = true): void {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    if (showAlerts) {
      alert("This browser does not support camera access.");
    }
    return;
  }
  
  if (navigator.mediaDevices.getSupportedConstraints().focusMode) {
    console.log("Browser supports focus mode");
  } else if (showAlerts) {
    alert("The browser does not support focus mode.");
  }
}

/**
 * Apply advanced camera settings to the current video track
 * @param track The video track to configure
 * @param settings The settings to apply
 */
export async function applyAdvancedCameraSettings(
  track: MediaStreamTrack,
  settings: {
    disableAutofocus?: boolean;
    focusDistance?: number;
    whiteBalance?: string;
    exposureMode?: string;
  }
): Promise<boolean> {
  if (!track || track.kind !== 'video') {
    return false;
  }

  try {
    // Get current capabilities
    const capabilities = track.getCapabilities();
    const constraints: MediaTrackConstraints = {};
    
    // Configure focus settings
    if (settings.disableAutofocus && capabilities.focusMode?.includes('manual')) {
      constraints.focusMode = 'manual';
      
      // Set focus distance if provided and supported
      if (settings.focusDistance !== undefined && capabilities.focusDistance) {
        constraints.focusDistance = settings.focusDistance;
      }
    }
    
    // Configure white balance if supported
    if (settings.whiteBalance && capabilities.whiteBalanceMode) {
      constraints.whiteBalanceMode = settings.whiteBalance;
    }
    
    // Configure exposure if supported
    if (settings.exposureMode && capabilities.exposureMode) {
      constraints.exposureMode = settings.exposureMode;
    }
    
    // Apply constraints
    await track.applyConstraints(constraints);
    return true;
  } catch (err) {
    console.error("Error applying camera settings:", err);
    return false;
  }
} 