import { useEffect, useRef, useState } from 'react'
import './App.css'

import {rgbToHsl, hslToRgb, shiftHue} from "./components/colorConversion"
import {xyToArrayIndex, indexToXY, inRange} from "./components/coordinateCalc"
import {downloadCanvasAsJPEG} from "./components/fileIO"

import {Canvas} from "./components/CanvasComponent"


function App() {
  const [colorSource, setcolorSource] = useState([])
  // { 
  //     position: [1, 2],
  //     color: [0.1, 0.1, 0.1],
  //     threshold: {
  //         hue: 0.1,
  //         sat: 0.1,
  //         bri: 0.1,
  //         radius: 20,  // IN PIXELS
  //     }
  // }

  const [canvasAttributes, setCanvasAttributes] = useState({width: 0, height: 0, ratio: 0,})
  const [canvasHorizontal, setCanvasHorizontal] = useState(false);
  const [imageSource, setImageSource] = useState("");

  const [showMatte, setShowMatte] = useState(false);

  const [selectedPoint, setSelectedPoint] = useState(null);

  const mainContextRef = useRef(null);
  
  const maskCanvasRef = useRef(null);

  // UPDATE MASK ARRAY ON IMAGE UPDATE
  useEffect(() => {
    document.querySelector(".matte-canvas").width = canvasAttributes.width;
    document.querySelector(".matte-canvas").height = canvasAttributes.height;

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
    ctx.beginPath();
    ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);

    window.addEventListener('resize', changeImageHolderDirection);
  }, [canvasAttributes])

  useEffect(() => {if (canvasAttributes.width !== 0 && showMatte === true) updateMaskImage()}, [colorSource, showMatte])


  const changeImageHolderDirection = () => {
    var windowRatio = window.innerWidth / window.innerHeight;

    if (canvasAttributes.ratio > windowRatio) {
        setCanvasHorizontal(true)
    } else {
        setCanvasHorizontal(false)
    }
  }

  const updateMaskImage = () => {
    // GET ALL PIXEL COLOUR
    var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    var data = imageData.data;

    var newMask = new Array(canvasAttributes.width * canvasAttributes.height);

    let totalPixelCount = 0;
    let updatedPixelCount = 0;
            
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
    let imgdt = ctx.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    let dt = imgdt.data;
    
    // let dataCopy = [...dt]

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

              // dt[pixelIndex*4] = 255;
              // dt[pixelIndex*4+1] = 255;
              // dt[pixelIndex*4+2] = 255;
              // dt[pixelIndex*4+3] = 255;

              if (showMatte === true) {
                var id = ctx.createImageData(1,1); // only do this once per page
                var d = id.data;                        // only do this once per page
                d[0] = 255;
                d[1] = 255;
                d[2] = 255;
                d[3] = 255;
                ctx.putImageData( id, pixelX, pixelY );     
              }

              updatedPixelCount++
            }

          }
        } 
      }

      console.log(updatedPixelCount)
    })

    // imgdt.data = dataCopy;
    console.log("UPDATE COLOR")
  }

  return (
    <div className="App">
      <div className="canvas-holder" data-image-direction={canvasHorizontal ? "horizontal" : "vertical"}>
          <div className="canvas-holder-inner" style={canvasAttributes ? {aspectRatio: `${canvasAttributes.width} / ${canvasAttributes.height}`} : {}}>
              <div className="indicator-holder">
                {colorSource.map((color, index) => {
                  let indicatorStyle = {
                    top: `${color.position[1] / canvasAttributes.height * 100}%`, 
                    left: `${color.position[0] / canvasAttributes.width * 100}%`,
                    backgroundColor: `hsl(${color.color[0] * 360}, ${color.color[1] * 100}%, ${color.color[2] * 100}%)`
                  };
                  return <div className='indicator' key={index} style={indicatorStyle}></div>
                })}
              </div>
              <canvas className={showMatte ? 'matte-canvas' : 'matte-canvas hidden'} ref={maskCanvasRef}></canvas>
              <Canvas src={imageSource} changeImageHolderDirection={changeImageHolderDirection} canvasAttributes={canvasAttributes} setCanvasAttributes={setCanvasAttributes} setcolorSource={setcolorSource} colorSource={colorSource} contextRef={mainContextRef}/>
          </div>
      </div>
      <button className="show-hide-canvas-btn" onClick={() => {setShowMatte(!showMatte)}}>{showMatte ? "HIDE MATTE" : "SHOW MATTE"}</button>
      <button onClick={() => {setImageSource("./img.jpg")}} className='open-file-btn'>OPEN FILE</button>
      <button onClick={downloadCanvasAsJPEG}>download as jpg</button>
      <button>SHOW MATTE</button>
    </div>
  )
}

export default App
