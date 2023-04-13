import React, { useEffect, useRef} from 'react';

export const MaskCanvas = React.memo(() => {
    
    const maskCanvasRef = useRef(null);

    useEffect(() => {

    }, [])
        
    const updateMaskImage = () => {
        // GET ALL PIXEL COLOUR
        var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
        var data = imageData.data;

        var newMask = new Array(canvasAttributes.width * canvasAttributes.height);

        let totalPixelCount = 0;
        let updatedPixelCount = 0;

        colorSource.forEach(colorPoint => {
        let targetHSL = colorPoint.color;

        // GET COLOUR ORIGIN
        let colourCenterX = colorPoint.position[0];
        let colourCenterY = colorPoint.position[1];
        let radius = colorPoint.threshold.radius;
        
        // SHOULD NOT EXCEED LEFT RIGHT BOUNDAIES
        let startPixelX = Math.max(colourCenterX - radius - 1, 0);
        let endPixelX = Math.min(colourCenterX + radius + 1, canvasAttributes.width);

        // SHOULD NOT EXCEED TOP BOTTOM BOUNDAIES
        let startPixelY = Math.max(colourCenterY - radius - 1, 0);
        let endPixelY = Math.min(colourCenterY + radius + 1, canvasAttributes.height);

        for (let pixelX = startPixelX; pixelX < endPixelX ; pixelX++) {
            for (let pixelY = startPixelY; pixelY < endPixelY ; pixelY++) {
            // 1. SEE IF PIXEL IS IN RANGE
            if (inRange(pixelX, pixelY, colourCenterX, colourCenterY, radius)) {
                totalPixelCount++

                // 2. SEE IF COLOR FITS REQUIREMENT
                let index = xyToArrayIndex(pixelX, pixelY, canvasAttributes.width) * 4;
                let pixelColorRGB = [data[index], data[index + 1], data[index + 2]];

                // GET AND COMPARE COLOR IN HSL
                let pixelColorHSL = rgbToHsl(...pixelColorRGB);

                let hueDiff = Math.abs(targetHSL[0] - pixelColorHSL[0]);
                let satDiff = Math.abs(targetHSL[1] - pixelColorHSL[1]);
                let briDiff = Math.abs(targetHSL[2] - pixelColorHSL[2]);

                if (hueDiff < colorPoint.threshold.hue && satDiff < colorPoint.threshold.sat && briDiff < colorPoint.threshold.bri) {
                let pixelIndex = xyToArrayIndex(pixelX, pixelY, canvasAttributes.width)

                newMask[pixelIndex] = 255;

                updatedPixelCount++
                }
            }
            } 
        }
        })

        let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
        let imgdt = ctx.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
        let dt = imgdt.data;

        let totalPX = 0
        let nonZeroPX = 0

        // for (let i = 0; i < newMask.length; i++) {
        //   imageData[i*4] = 0;
        //   imageData[i*4+1] = 0;
        //   imageData[i*4+2] = 0;
        // }

        // Red rectangle
        ctx.beginPath();
        ctx.lineWidth = "6";
        ctx.strokeStyle = "red";
        ctx.rect(5, 5, 290, 140);
        ctx.stroke();

        // Green rectangle
        ctx.beginPath();
        ctx.lineWidth = "4";
        ctx.strokeStyle = "green";
        ctx.rect(30, 30, 50, 50);
        ctx.stroke();

        // Blue rectangle
        ctx.beginPath();
        ctx.lineWidth = "10";
        ctx.strokeStyle = "blue";
        ctx.rect(50, 50, 150, 80);
        ctx.stroke();


        // for (let i = 0; i < dt.length; i+=4) {
        //   dt[i] = 155;
        //   dt[i+1] = 233;
        //   dt[i+2] = 55;
        //   dt[i+3] = 255;
        // }

        console.log("UPDATE COLOR")
    }

    return <canvas className='matte-canvas' ref={maskCanvasRef}></canvas>
});