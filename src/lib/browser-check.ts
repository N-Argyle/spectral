/**
 * Utility functions for checking browser capabilities
 */

/**
 * Checks if the browser supports focus mode for camera
 * This function will alert the user if focus mode is not supported
 */
export function checkBrowserCapabilities(): void {
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints) {
    if (navigator.mediaDevices.getSupportedConstraints().focusMode) {
      console.log("Browser supports focus mode");
    } else {
      alert("The browser does not support focus mode.");
    }
  } else {
    alert("The browser does not support media devices API.");
  }
} 