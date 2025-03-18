# Spectral

A browser-based spectrophotometer for webcams.

## Demo

[Test it out on Vercel](https://spectral-lilac.vercel.app/)

## Overview

Spectral is a web-based spectrophotometer application that allows you to perform basic spectrophotometric analysis using a regular webcam and a CD as a diffraction grating. The application captures spectra from the webcam feed, allows you to take reference and sample measurements, and calculates absorbance values.

## Features

- Real-time spectrum visualization
- Reference and sample spectrum capture
- Absorbance calculation and visualization
- Data export in CSV format for further analysis
- Fully responsive design with dark mode
- Draggable/croppable selection area for optimal spectrum capture

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Components**: Shadcn UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Typography**: Geist

## How It Works

1. The application accesses your webcam feed
2. Place your webcam in a box with a piece of CD (label and foil removed) over the lens. 
3. Create a slit in the box and shine a light through the slit.
4. If using a cuvette, place it in front of the slit.
5. Place camera at a 45 degree angle to the light source/slit.
6. You should see a rainbow of colors on the webcam feed. 
7. The application processes the image data to extract spectral information
8. You can take reference and sample measurements to calculate absorbance. 
9. If needed, you can take a blackout calibration to account for the noise from your webcam. Just put tape over then lens and click the blackout button.
10. Note: Live Spectrum does not show the actual spectrum, rather a spatial representation of the spectrum. It is more of a visual aid for setting up your experiment.

## Setup Instructions

### Software Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/spectral_web.git

# Navigate to the project directory
cd spectral_web

# Install dependencies
npm install

# Run the development server
npm run dev
```

## Usage

1. Place an empty cuvet (or solvent reference) in front of the light source
2. Adjust the selection box to capture the just the rainbow of colors from the diffraction grating (CD). It doesn't work well if you capture the whole frame.
3. Click "Capture Reference" to record baseline
4. Refill the cuvet with your sample and click "Capture Sample" to record sample spectrum
5. View the absorbance tab to see results
6. Download data for further analysis

## Limitations

- Wavelength calibration is approximate
- Resolution is limited by webcam quality and diffraction setup
- Best results require stable experimental conditions
- Intended for educational purposes, not analytical accuracy (it's really not that accurate)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request, or fork the repo. I won't be actively maintaining this project, but I'll try to merge any PRs.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by DIY spectrophotometry projects
- Built with Next.js and shadcn/ui 
