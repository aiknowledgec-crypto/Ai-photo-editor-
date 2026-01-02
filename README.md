# AI Background Remover - Offline Edition

A fully offline, professional-grade background removal tool with Snapseed/Remini-level quality. No external APIs, no server required, no internet connection needed.

## Features

### Core Functionality
- **One-Tap Background Removal**: Advanced Sobel edge detection with smart contrast analysis
- **Auto Subject Detection**: Center-focus detection with automatic foreground/background separation
- **Clean Edges**: Hair, hands, and face priority with intelligent edge feathering
- **No White Outline**: Smooth, natural cutouts with morphological operations
- **HD Output**: Full resolution processing and export

### Manual Refinement Tools
- **Restore Brush**: Bring back accidentally erased areas
- **Erase Brush**: Remove extra background pixels with precision
- **Adjustable Brush Size**: 5-100px for fine to broad strokes
- **Brush Hardness Control**: 0-100% for soft to hard edges
- **Zoom & Pan**: Precision editing with zoom levels from 50% to 300%

### Smart AI Logic
- **Contrast-Based Detection**: Analyzes pixel contrast to identify subjects
- **Skin Tone Preservation**: Intelligent algorithms protect natural skin colors
- **Auto Edge Refinement**: Gaussian blur feathering for smooth transitions
- **Automatic Fallback**: Graceful handling of difficult images

### Output Options
- **Transparent Background (PNG)**: Perfect for overlays and compositions
- **Solid Color Background**: Choose any color for the background
- **Blur Background**: Bokeh effect for professional product photos
- **Replace Background**: Import custom background images

### Performance
- **WebWorker Processing**: Heavy computations run in background thread
- **Non-Blocking UI**: Smooth, responsive interface during processing
- **Optimized for Low-End Devices**: Works smoothly on Android phones and tablets
- **Instant Feedback**: Real-time preview of all adjustments

## How to Use

### Getting Started
1. Open `index.html` in any modern web browser
2. Click **UPLOAD** to select an image or **PASTE** to paste from clipboard
3. Click **REMOVE** to automatically detect and remove the background

### Refining Results
1. Use **RESTORE** brush to bring back erased areas
2. Use **ERASE** brush to remove extra background
3. Adjust **SENSITIVITY** for better detection on difficult images
4. Adjust **EDGE FEATHER** for smoother transitions

### Customizing Background
- Select **TRANSPARENT** for PNG with no background
- Select **SOLID** and choose a color for solid backgrounds
- Select **BLUR** and adjust blur amount for bokeh effect

### Exporting
- Click **PNG** to download with transparent background
- Click **JPG** to download with solid background
- Click **COPY** to copy to clipboard for immediate use

## Technical Implementation

### Algorithms
- **Sobel Edge Detection**: Detects object boundaries using gradient analysis
- **Contrast Analysis**: Identifies foreground vs background based on pixel contrast
- **Morphological Dilation**: Fills small gaps in detected objects
- **Gaussian Blur Feathering**: Smooths edges for natural appearance
- **Center-Focus Boost**: Prioritizes center of image for subject detection

### Performance Optimizations
- **WebWorker**: Offloads heavy processing to background thread
- **Canvas Optimization**: Uses `willReadFrequently` context hint
- **Efficient Memory**: Reuses buffers and minimizes allocations
- **Touch Support**: Optimized for mobile and tablet devices

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Keyboard Shortcuts
- **R**: Remove background
- **E**: Switch to Restore brush
- **D**: Switch to Erase brush
- **Z**: Undo
- **Y**: Redo

## Tips for Best Results

1. **Lighting**: Use images with clear contrast between subject and background
2. **Sensitivity**: Increase for low-contrast images, decrease for high-contrast
3. **Edge Feather**: Use 8-12px for natural edges, 0-4px for sharp edges
4. **Brush Size**: Use smaller sizes for detailed areas (hair, hands)
5. **Multiple Passes**: Use Restore/Erase brushes multiple times for refinement

## Privacy & Security
- **100% Offline**: All processing happens in your browser
- **No Data Collection**: No images are uploaded or stored
- **No Tracking**: No analytics or telemetry
- **Fully Open**: All algorithms are transparent and visible in source code

## File Structure
```
index.html      - Main application interface
remover.js      - Core engine and UI controller
remover.html    - Alternative single-file version
```

## Performance Notes
- Processing time depends on image size and device capabilities
- Typical processing: 1-5 seconds for 1080p images
- Works on devices with 2GB+ RAM
- Optimized for low-end Android phones

## Troubleshooting

### Image won't load
- Ensure image format is supported (JPG, PNG, WebP, GIF)
- Check browser console for errors
- Try a different image

### Background removal not working well
- Increase SENSITIVITY slider
- Try adjusting EDGE FEATHER
- Use manual Restore/Erase brushes to refine

### Performance issues
- Reduce image size before uploading
- Close other browser tabs
- Clear browser cache
- Use a more recent browser version

## Future Enhancements
- Batch processing
- Custom background upload
- Advanced color correction
- Hair/fur specific algorithms
- Shadow preservation
- Real-time preview improvements

## License
Open Source - Free to use and modify

## Support
For issues or suggestions, check the browser console for error messages and ensure you're using a supported browser.

---

**Made with ❤️ for creators, designers, and everyone who needs professional background removal.**
