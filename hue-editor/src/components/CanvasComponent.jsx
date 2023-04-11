import { useEffect, useRef } from 'react'
import {rgbToHsl, hslToRgb, shiftHue} from "./colorConversion"

export const Canvas = props => {
    const canvasRef = useRef(null);
    const canvasImageRef = useRef(new Image());
    
    var canvas = null;
    var context = null;
    var canvasImage = null;

    const handleMouseClick = (e) => {
        let {mouseX, mouseY} = getMouseClickPosition(e);

        let context = e.target.getContext('2d', {willReadFrequently : true});
        
        // Get the pixel color data at the clicked point
        var pixelData = context.getImageData(mouseX, mouseY, 1, 1).data;
    
        // Get the RGB color values from the pixel data
        var red = pixelData[0];
        var green = pixelData[1];
        var blue = pixelData[2];
    
        // ctx.putImageData(getUpdatedImageData(), 0, 0);
    
        if (props.canvasAttributes.ratio !== 0) {
            addIndicator(mouseX, mouseY, [red, green, blue]);
        }
    
        // document.querySelector(".clicked-color").setAttribute("style", `background-color: rgb(${red}, ${green}, ${blue});`)
    
        // Display the color in the console
        console.log(`Clicked color: rgb(${red}, ${green}, ${blue}) @ [${mouseX}, ${mouseY}]`);
    }

    const getMouseClickPosition = (e) => {
        // DUE TO THE CANVAS BEING SCALED BY CSS
        // GETTING THE REAL SIZE IS REQUIRED BEFORE DETERMINING THE MOUSE CLICK
        let canvas = e.target;

        var rect = canvas.getBoundingClientRect();
    
        let realWidth = rect.width;
        let realHeight = rect.height;

        let clickXWithoutScale = e.clientX - rect.left;
        let clickYWithoutScale = e.clientY - rect.top;
    
        let mouseX = Math.floor(clickXWithoutScale * (canvas.width / realWidth));
        let mouseY = Math.floor(clickYWithoutScale * (canvas.height / realHeight));
    
        return {mouseX, mouseY}
    }

    const imageOnLoad = () => {
        // Get the size of the image
        let imageWidth = canvasImage.naturalWidth;
        let imageHeight = canvasImage.naturalHeight;
        let imageAspectRatio = imageWidth / imageHeight;

        props.setCanvasAttributes({
            width: imageWidth,
            height: imageHeight,
            ratio: imageAspectRatio,
        })

        props.changeImageHolderDirection();
        
        // Set the size of the canvas to match the image size
        canvas.width = imageWidth;
        canvas.height = imageHeight;

        if (context) {
            console.log("drawing")
            // console.log(imageWidth, imageHeight)
            // Draw the scaled-down image onto the canvas
            context.drawImage(canvasImage, 0, 0, imageWidth, imageHeight);
        }
    }

    const addIndicator = (x, y, colorRGB) => {
        // let leftPercentage = x / canvas.width;
        // let topPercentage = y / canvas.height;
    
        // let newIndicatorElement = document.createElement("div");
        // newIndicatorElement.classList.add("indicator")
        // newIndicatorElement.setAttribute("style", `top: ${(topPercentage*100).toFixed(2)}%; left: ${(leftPercentage*100).toFixed(2)}%; background-color: rgb(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]});`)
    
        let colorHSL = rgbToHsl(...colorRGB);
    
        props.setcolorSource([...props.colorSource,
            {
                position: [x, y],
                color: [colorHSL[0], colorHSL[1], colorHSL[2]],
                threshold: {
                    hue: 0.1,  // DEFAULT VALUES
                    sat: 0.1,
                    bri: 0.1,
                    radius: 20,
                }
            }
        ])
    }

    // FIRST LOAD --> AFTER LOAD
    useEffect(() => {
        canvas = canvasRef.current;

        context = canvas.getContext('2d', {willReadFrequently : true});

        canvasImage = canvasImageRef.current;
        canvasImage.onload = imageOnLoad;

        if (props.src != "") {
            canvasImageRef.current.src = props.src;
            props.changeImageHolderDirection();
        }
    }, [props.colorSource])

    useEffect(() => {
        if (props.src != "") {
            canvasImageRef.current.src = props.src;
            props.changeImageHolderDirection();
        }
    }, [props.src])

    return <canvas className='main-canvas' onMouseDown={handleMouseClick} ref={canvasRef}/>
}