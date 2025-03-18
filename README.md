# Spectral Web

A browser-based spectrophotometer application built with Next.js 15 and modern web technologies.

## Overview

Spectral Web is a web-based spectrophotometer application that allows you to perform basic spectrophotometric analysis using a regular webcam and a CD as a diffraction grating. The application captures spectra from the webcam feed, allows you to take reference and sample measurements, and calculates absorbance values.

![Spectral Web Screenshot](public/screenshot.png)

## Features

- Real-time spectrum visualization
- Reference and sample spectrum capture
- Absorbance calculation and visualization
- Data export in CSV format for further analysis
- Fully responsive design with dark mode
- Draggable selection area for optimal spectrum capture

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Components**: Shadcn UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Typography**: Geist

## How It Works

1. The application accesses your webcam feed
2. A CD used as a diffraction grating splits light into its component wavelengths
3. The application processes the image data to extract spectral information
4. You can take reference and sample measurements to calculate absorbance

## Setup Instructions

### Hardware Setup

1. Place a CD (or piece of CD) in front of your webcam lens
2. Set up a light source (preferably white LED) and a sample holder (cuvet)
3. Position the setup so the diffracted spectrum is visible in the webcam

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
2. Adjust the selection box to capture the spectrum
3. Click "Capture Reference" to record baseline
4. Replace with your sample cuvet
5. Click "Capture Sample" to record sample spectrum
6. View the absorbance tab to see results
7. Download data for further analysis

## Limitations

- Wavelength calibration is approximate
- Resolution is limited by webcam quality and diffraction setup
- Best results require stable experimental conditions
- Intended for educational purposes, not analytical accuracy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by DIY spectrophotometry projects
- Built with Next.js and shadcn/ui components
