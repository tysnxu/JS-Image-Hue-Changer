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

  const [showMatte, setShowMatte] = useState(true);  // IF HIDE MATTE, REVEAL THE UPDATED PIXEL COLOUR
  const [editMode, setEditMode] = useState(0)  // -1: NO INTERACTION | 0: ADD | 1: CHANGE HUE | 2: CHANGE SATURATION | 3: CHANGE BRIGHTNESS

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
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);

    window.addEventListener('resize', changeImageHolderDirection);
  }, [canvasAttributes])

  useEffect(() => {if (canvasAttributes.width !== 0) {
    updateMaskImage()
    setSelectedPoint(colorSource.length - 1)
  }}, [colorSource, showMatte])


  const changeImageHolderDirection = () => {
    var windowRatio = window.innerWidth / window.innerHeight;

    if (canvasAttributes.ratio > windowRatio) {
        setCanvasHorizontal(true)
    } else {
        setCanvasHorizontal(false)
    }
  }

  const changePixelToColour = (ctx, rgbValues, pixelX, pixelY) => {
    var id = ctx.createImageData(1,1);
    var d = id.data;   
    d[0] = rgbValues[0];  // RED
    d[1] = rgbValues[1];  // GREEN
    d[2] = rgbValues[2];  // BLUE
    d[3] = 255;  // ALPHA

    ctx.putImageData( id, pixelX, pixelY );   
  }

  const updateMaskImage = () => {
    if (canvasAttributes.width === 0) return false

    // GET ALL PIXEL COLOUR
    var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    var data = imageData.data;

    var newMask = new Array(canvasAttributes.width * canvasAttributes.height);

    let totalPixelCount = 0;
    let updatedPixelCount = 0;

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
    ctx.clearRect(0, 0, canvasAttributes.width, canvasAttributes.height);

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

              if (showMatte === true) {
                changePixelToColour(ctx, [255, 255, 255], pixelX, pixelY)
              }

              updatedPixelCount++
            }
          }
        } 
      }

      // console.log(updatedPixelCount)
    })

    // imgdt.data = dataCopy;
    // console.log("UPDATE COLOR")
  }

  const toggleEditMode = () => {
    editMode === 0 ? setEditMode(-1) : setEditMode(0);
    setSelectedPoint(null);
  }

  const deselectColourSample = (e) => {
    setSelectedPoint(null);
    setEditMode(-1);
  }

  const handleCanvasClicks = (e) => {
    if (editMode !== 0) {
        deselectColourSample();
        return ;
    }

    let {mouseX, mouseY} = getMouseClickPosition(e);

    // Get the pixel color data at the clicked point
    var pixelData = mainContextRef.current.getImageData(mouseX, mouseY, 1, 1).data;

    // Get the RGB color values from the pixel data
    var red = pixelData[0];
    var green = pixelData[1];
    var blue = pixelData[2];

    if (canvasAttributes.ratio !== 0) {
        // ONLY ADD COLOUR SAMPLE IF IN "ADD COLOUR MODE"
        addIndicator(mouseX, mouseY, [red, green, blue]);
    }

    // Display the color in the console
    console.log(`Clicked color: rgb(${red}, ${green}, ${blue}) @ [${mouseX}, ${mouseY}]`);
  }

  const getMouseClickPosition = (e) => {
      // DUE TO THE CANVAS BEING SCALED BY CSS
      // GETTING THE REAL SIZE IS REQUIRED BEFORE DETERMINING THE MOUSE CLICK
      var rect = e.target.getBoundingClientRect();

      let realWidth = rect.width;
      let realHeight = rect.height;

      let clickXWithoutScale = e.clientX - rect.left;
      let clickYWithoutScale = e.clientY - rect.top;

      let mouseX = Math.floor(clickXWithoutScale * (canvasAttributes.width / realWidth));
      let mouseY = Math.floor(clickYWithoutScale * (canvasAttributes.height / realHeight));

      return {mouseX, mouseY}
  }

  const addIndicator = (x, y, colorRGB) => {
      let colorHSL = rgbToHsl(...colorRGB);

      setcolorSource([...colorSource,
          {
              position: [x, y],
              color: [colorHSL[0], colorHSL[1], colorHSL[2]],
              threshold: {
                  hue: 0.5,  // DEFAULT VALUES
                  sat: 0.8,
                  bri: 0.9,
                  radius: 120,
              }
          }
      ])
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
                  return <div className='indicator' onClick={() => {setSelectedPoint(index); setEditMode(1)}} key={index} style={indicatorStyle}></div>
                })}
              </div>
              <div className='canvas-interaction-holder' onClick={handleCanvasClicks}></div>
              <canvas className='matte-canvas' ref={maskCanvasRef}></canvas>
              <Canvas src={imageSource} changeImageHolderDirection={changeImageHolderDirection} canvasAttributes={canvasAttributes} setCanvasAttributes={setCanvasAttributes} contextRef={mainContextRef}/>
          </div>
          <div className='blank-background' onClick={deselectColourSample}></div>
      </div>
      {imageSource !== "" ? <>
        <button className="left-row-btn show-hide-canvas-btn ui-btn" onClick={() => {setShowMatte(!showMatte)}}>{showMatte ? "HIDE MATTE" : "SHOW MATTE"}</button>
        <button className={editMode === 0 ? "left-row-btn add-color-sample-btn btn-active ui-btn" : "left-row-btn add-color-sample-btn ui-btn"} onClick={toggleEditMode}>ADD COLOR SAMPLE</button>
      </> : ""}
      {selectedPoint !== null ? <input type="range" key={selectedPoint} className='left-row-btn range-toggle-slider ui-btn' min="50" max="500" onChange={(e) => {colorSource[selectedPoint].threshold.radius = e.target.value; updateMaskImage()}} defaultValue={colorSource[selectedPoint].threshold.radius}/> : ""}
      <button onClick={() => {setImageSource("./img.jpg")}} className='open-file-btn right-row-btn ui-btn'>OPEN FILE</button>
      <button onClick={downloadCanvasAsJPEG} className='right-row-btn ui-btn'>download as jpg</button>
    </div>
  )
}

export default App
