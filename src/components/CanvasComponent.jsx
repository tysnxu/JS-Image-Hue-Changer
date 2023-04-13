import { useEffect, useRef } from 'react'
import React from 'react';

export const Canvas = React.memo( props => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasImageRef = useRef(new Image());

    const imageDownScaleFactor = 1;  // SCALE DOWN THE IMAGE/CANVAS TO PRESERVE MEMORY
    
    var canvas = null;
    var context = null;
    var canvasImage = null;


    useEffect(() => {props.contextRef.current = context}, [context])

    const imageOnLoad = () => {
        // Get the size of the image
        let imageWidth = canvasImage.naturalWidth;
        let imageHeight = canvasImage.naturalHeight;

        imageWidth = Math.floor(imageWidth / imageDownScaleFactor)
        imageHeight = Math.floor(imageHeight / imageDownScaleFactor)

        let imageAspectRatio = imageWidth / imageHeight;

        console.log(`OPENING IMAGE: ${imageWidth} / ${imageHeight}`)

        props.setCanvasAttributes({
            width: imageWidth,
            height: imageHeight,
            ratio: imageAspectRatio,
        })

        props.changeImageHolderDirection();
        
        // Set the size of the canvas to match the image size
        canvas.width = imageWidth;
        canvas.height = imageHeight;

        // Draw the scaled-down image onto the canvas
        context.drawImage(canvasImage, 0, 0, imageWidth, imageHeight);
    }

    // FIRST LOAD --> AFTER LOAD
    useEffect(() => {
        canvas = canvasRef.current;
        contextRef.current = canvas.getContext('2d', {willReadFrequently : true});

        props.mainCanvasRef.current = canvasRef.current;
        context = contextRef.current;

        canvasImage = canvasImageRef.current;
        canvasImage.onload = imageOnLoad;

        if (props.src != "") {
            canvasImageRef.current.src = props.src;
            props.changeImageHolderDirection();
        }
    }, [])

    useEffect(() => {
        if (props.src != "") {
            canvasImageRef.current.src = props.src;
            props.changeImageHolderDirection();
        }
    }, [props.src])

    return <canvas className='main-canvas' ref={canvasRef}/>
})