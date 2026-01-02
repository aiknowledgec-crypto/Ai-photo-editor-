// ============================================
// AI BACKGROUND REMOVER - OFFLINE ENGINE
// ============================================

class BackgroundRemover {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.originalImage = null;
        this.currentImage = null;
        this.maskCanvas = null;
        this.maskCtx = null;
        this.history = [];
        this.historyIndex = -1;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDrawing = false;
        this.currentTool = 'remove';
        this.brushSize = 20;
        this.brushHardness = 70;
        this.sensitivity = 70;
        this.edgeFeather = 8;
        this.backgroundColor = 'transparent';
        this.bgColor = '#ffffff';
        this.blurAmount = 10;
        this.worker = null;
        this.initWorker();
    }

    initWorker() {
        const workerCode = `
            self.onmessage = function(e) {
                const { imageData, sensitivity, edgeFeather } = e.data;
                const data = imageData.data;
                const width = imageData.width;
                const height = imageData.height;
                
                // Create mask
                const mask = new Uint8ClampedArray(width * height);
                
                // Sobel edge detection
                const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
                const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
                
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        let gx = 0, gy = 0;
                        
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const idx = ((y + ky) * width + (x + kx)) * 4;
                                const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                                gx += gray * sobelX[kernelIdx];
                                gy += gray * sobelY[kernelIdx];
                            }
                        }
                        
                        const magnitude = Math.sqrt(gx * gx + gy * gy);
                        mask[y * width + x] = magnitude;
                    }
                }
                
                // Contrast-based foreground detection
                const threshold = (255 - sensitivity * 2.55) * 0.5;
                const centerX = width / 2;
                const centerY = height / 2;
                
                for (let i = 0; i < mask.length; i++) {
                    const y = Math.floor(i / width);
                    const x = i % width;
                    const distToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    const centerBoost = Math.max(0, 1 - distToCenter / Math.max(width, height));
                    
                    if (mask[i] > threshold || centerBoost > 0.3) {
                        mask[i] = Math.min(255, mask[i] + centerBoost * 100);
                    } else {
                        mask[i] = 0;
                    }
                }
                
                // Morphological dilation
                const dilated = new Uint8ClampedArray(mask);
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        let max = mask[y * width + x];
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                max = Math.max(max, mask[(y + dy) * width + (x + dx)]);
                            }
                        }
                        dilated[y * width + x] = max;
                    }
                }
                
                // Gaussian blur for feathering
                const feathered = new Uint8ClampedArray(dilated);
                const sigma = edgeFeather / 2;
                const radius = Math.ceil(edgeFeather);
                
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        let sum = 0, weight = 0;
                        
                        for (let dy = -radius; dy <= radius; dy++) {
                            for (let dx = -radius; dx <= radius; dx++) {
                                const ny = Math.max(0, Math.min(height - 1, y + dy));
                                const nx = Math.max(0, Math.min(width - 1, x + dx));
                                const dist = dx * dx + dy * dy;
                                const gaussian = Math.exp(-dist / (2 * sigma * sigma));
                                
                                sum += dilated[ny * width + nx] * gaussian;
                                weight += gaussian;
                            }
                        }
                        
                        feathered[y * width + x] = sum / weight;
                    }
                }
                
                // Apply mask to image
                for (let i = 0; i < data.length; i += 4) {
                    const maskIdx = Math.floor(i / 4);
                    const alpha = feathered[maskIdx];
                    data[i + 3] = alpha;
                }
                
                self.postMessage({ imageData, mask: feathered });
            };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.originalImage = img;
                    this.resizeCanvasToImage();
                    this.drawImage();
                    this.history = [];
                    this.historyIndex = -1;
                    const emptyState = document.getElementById('emptyState');
                    if (emptyState) emptyState.style.display = 'none';
                    resolve();
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    resizeCanvasToImage() {
        const maxWidth = window.innerWidth * 0.7;
        const maxHeight = window.innerHeight - 100;
        let width = this.originalImage.width;
        let height = this.originalImage.height;

        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    }

    drawImage() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.canvas.width / 2 + this.panX, -this.canvas.height / 2 + this.panY);
        
        // Draw checkerboard for transparency
        this.drawCheckerboard();
        
        // Draw image
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Apply mask
        if (this.maskCanvas) {
            const maskImageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            for (let i = 0; i < maskImageData.data.length; i += 4) {
                imageData.data[i + 3] = maskImageData.data[i + 3];
            }
            
            this.ctx.putImageData(imageData, 0, 0);
        }
        
        // Apply background
        if (this.backgroundColor === 'solid') {
            this.ctx.globalCompositeOperation = 'destination-over';
            this.ctx.fillStyle = this.bgColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.backgroundColor === 'blur') {
            this.ctx.globalCompositeOperation = 'destination-over';
            this.applyBlurBackground();
        }
        
        this.ctx.restore();
    }

    drawCheckerboard() {
        const squareSize = 10;
        for (let y = 0; y < this.canvas.height; y += squareSize) {
            for (let x = 0; x < this.canvas.width; x += squareSize) {
                if ((Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0) {
                    this.ctx.fillStyle = '#2a2a2a';
                } else {
                    this.ctx.fillStyle = '#1a1a1a';
                }
                this.ctx.fillRect(x, y, squareSize, squareSize);
            }
        }
    }

    applyBlurBackground() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Simple box blur
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        const radius = this.blurAmount;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = 0, g = 0, b = 0, count = 0;
            const pixelIndex = i / 4;
            const x = pixelIndex % tempCanvas.width;
            const y = Math.floor(pixelIndex / tempCanvas.width);
            
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = Math.max(0, Math.min(tempCanvas.width - 1, x + dx));
                    const ny = Math.max(0, Math.min(tempCanvas.height - 1, y + dy));
                    const idx = (ny * tempCanvas.width + nx) * 4;
                    
                    r += data[idx];
                    g += data[idx + 1];
                    b += data[idx + 2];
                    count++;
                }
            }
            
            data[i] = r / count;
            data[i + 1] = g / count;
            data[i + 2] = b / count;
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        this.ctx.drawImage(tempCanvas, 0, 0);
    }

    async removeBackground() {
        showProcessing(true);
        
        return new Promise((resolve) => {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            this.worker.onmessage = (e) => {
                const { imageData: resultData } = e.data;
                this.maskCtx.putImageData(resultData, 0, 0);
                this.saveHistory();
                this.drawImage();
                showProcessing(false);
                resolve();
            };
            
            this.worker.postMessage({
                imageData,
                sensitivity: this.sensitivity,
                edgeFeather: this.edgeFeather
            });
        });
    }

    brush(x, y, mode) {
        if (!this.maskCanvas) return;
        
        const size = this.brushSize;
        const hardness = this.brushHardness / 100;
        
        this.maskCtx.globalCompositeOperation = mode === 'restore' ? 'source-over' : 'destination-out';
        
        const gradient = this.maskCtx.createRadialGradient(x, y, 0, x, y, size);
        if (mode === 'restore') {
            gradient.addColorStop(0, `rgba(255, 255, 255, ${hardness})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
            gradient.addColorStop(0, `rgba(0, 0, 0, ${hardness})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        
        this.maskCtx.fillStyle = gradient;
        this.maskCtx.beginPath();
        this.maskCtx.arc(x, y, size, 0, Math.PI * 2);
        this.maskCtx.fill();
        
        this.drawImage();
    }

    saveHistory() {
        this.historyIndex++;
        this.history = this.history.slice(0, this.historyIndex);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.maskCanvas.width;
        tempCanvas.height = this.maskCanvas.height;
        tempCanvas.getContext('2d').drawImage(this.maskCanvas, 0, 0);
        
        this.history.push(tempCanvas);
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreFromHistory();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreFromHistory();
        }
    }

    restoreFromHistory() {
        if (this.history[this.historyIndex]) {
            this.maskCtx.drawImage(this.history[this.historyIndex], 0, 0);
            this.drawImage();
        }
    }

    reset() {
        if (this.maskCanvas) {
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
            this.history = [];
            this.historyIndex = -1;
            this.drawImage();
        }
    }

    zoom(factor) {
        this.zoom *= factor;
        this.zoom = Math.max(0.5, Math.min(3, this.zoom));
        this.drawImage();
        updateZoomDisplay();
    }

    fitToScreen() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.drawImage();
        updateZoomDisplay();
    }

    downloadPNG() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(this.originalImage, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const maskImageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i + 3] = maskImageData.data[i + 3];
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        const link = document.createElement('a');
        link.href = tempCanvas.toDataURL('image/png');
        link.download = 'removed-background.png';
        link.click();
        
        showToast('PNG downloaded!', 'success');
    }

    downloadJPG() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = this.bgColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(this.originalImage, 0, 0);
        
        const link = document.createElement('a');
        link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
        link.download = 'removed-background.jpg';
        link.click();
        
        showToast('JPG downloaded!', 'success');
    }

    copyToClipboard() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(this.originalImage, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const maskImageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i + 3] = maskImageData.data[i + 3];
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        tempCanvas.toBlob((blob) => {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
                showToast('Copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        });
    }
}

// ============================================
// UI CONTROLLER
// ============================================

let remover = null;

function initializeApp() {
    remover = new BackgroundRemover('mainCanvas');
    setupEventListeners();
}

function setupEventListeners() {
    // File upload
    document.getElementById('uploadBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            remover.loadImage(e.target.files[0]).then(() => {
                showToast('Image loaded!', 'success');
            });
        }
    });

    // Paste image
    document.getElementById('pasteBtn').addEventListener('click', () => {
        navigator.clipboard.read().then((items) => {
            for (let item of items) {
                if (item.types.includes('image/png')) {
                    item.getType('image/png').then((blob) => {
                        remover.loadImage(blob).then(() => {
                            showToast('Image pasted!', 'success');
                        });
                    });
                }
            }
        }).catch(() => {
            showToast('No image in clipboard', 'error');
        });
    });

    // Main tools
    document.getElementById('removeBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.removeBackground();
        } else {
            showToast('Upload an image first', 'error');
        }
    });

    document.getElementById('restoreBtn').addEventListener('click', () => {
        remover.currentTool = 'restore';
        updateToolButtons();
    });

    document.getElementById('eraseBtn').addEventListener('click', () => {
        remover.currentTool = 'erase';
        updateToolButtons();
    });

    document.getElementById('undoBtn').addEventListener('click', () => {
        remover.undo();
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
        remover.redo();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (remover.originalImage && confirm('Reset all changes?')) {
            remover.reset();
        }
    });

    // Brush controls
    document.getElementById('brushSize').addEventListener('input', (e) => {
        remover.brushSize = parseInt(e.target.value);
        document.getElementById('brushSizeValue').textContent = e.target.value;
    });

    document.getElementById('brushHardness').addEventListener('input', (e) => {
        remover.brushHardness = parseInt(e.target.value);
        document.getElementById('brushHardnessValue').textContent = e.target.value;
    });

    // Detection controls
    document.getElementById('sensitivity').addEventListener('input', (e) => {
        remover.sensitivity = parseInt(e.target.value);
        document.getElementById('sensitivityValue').textContent = e.target.value;
    });

    document.getElementById('edgeFeather').addEventListener('input', (e) => {
        remover.edgeFeather = parseInt(e.target.value);
        document.getElementById('edgeFeatherValue').textContent = e.target.value;
    });

    // Background options
    document.querySelectorAll('.tool-option').forEach((opt) => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.tool-option').forEach((o) => o.classList.remove('selected'));
            opt.classList.add('selected');
            
            const bg = opt.dataset.bg;
            remover.backgroundColor = bg;
            
            document.getElementById('solidColorGroup').style.display = bg === 'solid' ? 'block' : 'none';
            document.getElementById('blurAmountGroup').style.display = bg === 'blur' ? 'block' : 'none';
            
            if (remover.originalImage) {
                remover.drawImage();
            }
        });
    });

    document.getElementById('bgColor').addEventListener('input', (e) => {
        remover.bgColor = e.target.value;
        document.getElementById('bgColorValue').textContent = e.target.value;
        if (remover.originalImage) {
            remover.drawImage();
        }
    });

    document.getElementById('blurAmount').addEventListener('input', (e) => {
        remover.blurAmount = parseInt(e.target.value);
        document.getElementById('blurAmountValue').textContent = e.target.value;
        if (remover.originalImage) {
            remover.drawImage();
        }
    });

    // Zoom controls
    document.getElementById('zoomInBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.zoom(1.2);
        }
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.zoom(0.8);
        }
    });

    document.getElementById('fitBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.fitToScreen();
        }
    });

    // Export
    document.getElementById('downloadPngBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.downloadPNG();
        } else {
            showToast('Upload an image first', 'error');
        }
    });

    document.getElementById('downloadJpgBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.downloadJPG();
        } else {
            showToast('Upload an image first', 'error');
        }
    });

    document.getElementById('copyBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.copyToClipboard();
        } else {
            showToast('Upload an image first', 'error');
        }
    });

    document.getElementById('downloadBtn').addEventListener('click', () => {
        if (remover.originalImage) {
            remover.downloadPNG();
        } else {
            showToast('Upload an image first', 'error');
        }
    });

    // Canvas interaction
    const canvas = document.getElementById('mainCanvas');
    canvas.addEventListener('mousedown', (e) => {
        if (remover.currentTool === 'restore' || remover.currentTool === 'erase') {
            remover.isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / remover.zoom + remover.canvas.width / 2 - remover.panX;
            const y = (e.clientY - rect.top) / remover.zoom + remover.canvas.height / 2 - remover.panY;
            remover.brush(x, y, remover.currentTool);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (remover.isDrawing && (remover.currentTool === 'restore' || remover.currentTool === 'erase')) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / remover.zoom + remover.canvas.width / 2 - remover.panX;
            const y = (e.clientY - rect.top) / remover.zoom + remover.canvas.height / 2 - remover.panY;
            remover.brush(x, y, remover.currentTool);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (remover.isDrawing) {
            remover.isDrawing = false;
            remover.saveHistory();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        remover.isDrawing = false;
    });

    // Touch support for mobile
    canvas.addEventListener('touchstart', (e) => {
        if (remover.currentTool === 'restore' || remover.currentTool === 'erase') {
            remover.isDrawing = true;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / remover.zoom + remover.canvas.width / 2 - remover.panX;
            const y = (touch.clientY - rect.top) / remover.zoom + remover.canvas.height / 2 - remover.panY;
            remover.brush(x, y, remover.currentTool);
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        if (remover.isDrawing && (remover.currentTool === 'restore' || remover.currentTool === 'erase')) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) / remover.zoom + remover.canvas.width / 2 - remover.panX;
            const y = (touch.clientY - rect.top) / remover.zoom + remover.canvas.height / 2 - remover.panY;
            remover.brush(x, y, remover.currentTool);
        }
    });

    canvas.addEventListener('touchend', () => {
        if (remover.isDrawing) {
            remover.isDrawing = false;
            remover.saveHistory();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') remover.removeBackground();
        if (e.key === 'e' || e.key === 'E') remover.currentTool = 'restore';
        if (e.key === 'd' || e.key === 'D') remover.currentTool = 'erase';
        if (e.key === 'z' || e.key === 'Z') remover.undo();
        if (e.key === 'y' || e.key === 'Y') remover.redo();
        updateToolButtons();
    });

    // Toolbar auto-hide
    let toolbarTimeout;
    canvas.addEventListener('mousemove', () => {
        document.getElementById('toolbar').classList.remove('hidden');
        clearTimeout(toolbarTimeout);
        toolbarTimeout = setTimeout(() => {
            document.getElementById('toolbar').classList.add('hidden');
        }, 3000);
    });
}

function updateToolButtons() {
    document.getElementById('restoreBtn').classList.toggle('active', remover.currentTool === 'restore');
    document.getElementById('eraseBtn').classList.toggle('active', remover.currentTool === 'erase');
}

function updateZoomDisplay() {
    document.getElementById('zoomLevel').textContent = Math.round(remover.zoom * 100) + '%';
}

function showProcessing(show) {
    document.getElementById('processingIndicator').classList.toggle('active', show);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize on load
window.addEventListener('load', initializeApp);
