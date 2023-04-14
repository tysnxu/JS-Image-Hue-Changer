import { useEffect, useRef, useState } from 'react'
import './App.css'

import {rgbToHsl, hslToRgb, shiftHue} from "./components/colorConversion"
import {xyToArrayIndex, indexToXY, powerOfDistance, inRange, lerp} from "./components/coordinateCalc"
import {downloadCanvasAsJPEG} from "./components/fileIO"

import {Canvas} from "./components/CanvasComponent"

import useLongPress from "./components/useLongPress";


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

  const [matteMode, setMatteMode] = useState(2); // 0: HIDDEN | 1: LIGHTEN | 2 : MULTIPLY | 3 : NORMAL (BW)
  const [editMode, setEditMode] = useState(0)  // -1: NO INTERACTION | 0: ADD | 1: CHANGE HUE | 2: CHANGE SATURATION | 3: CHANGE BRIGHTNESS | 4. CHANGE RADIUS

  const [selectedPoint, setSelectedPoint] = useState(null);

  const mainCanvasRef = useRef(null);
  const mainContextRef = useRef(null);
  const maskCanvasRef = useRef(null);

  // TODO: ADD HIDE INDICATORS

  const maskModeHintRef = useRef();
  const indicatorHolderRef = useRef();

  // UPDATE MASK ARRAY ON IMAGE UPDATE
  useEffect(() => {
    document.querySelector(".matte-canvas").width = canvasAttributes.width;
    document.querySelector(".matte-canvas").height = canvasAttributes.height;

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);

    changeImageHolderDirection()
    window.addEventListener('resize', changeImageHolderDirection);
  }, [canvasAttributes])

  useEffect(() => {if (canvasAttributes.width !== 0) {
    updateMaskImage()
    if (colorSource.length !== 0) {setSelectedPoint(colorSource.length - 1)} else {setEditMode(0); setSelectedPoint(null);}
  }}, [colorSource])

  useEffect(() => {if (canvasAttributes.width !== 0 && selectedPoint !== null && editMode !== 1 && editMode !== 2 && editMode !== 3) {
    setEditMode(1)
    
  }}, [selectedPoint])

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
    d[3] = rgbValues[3];  // ALPHA

    ctx.putImageData( id, pixelX, pixelY );   
  }

  const updateMaskImage = () => {
    if (canvasAttributes.width === 0) return false

    // GET ALL PIXEL COLOUR
    var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    var data = imageData.data;

    var newMask = new Array(canvasAttributes.width * canvasAttributes.height);

    let totalPixels = 0;
    let affectedPixels = 0;

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});

    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 255)";
    ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);
    // ctx.clearRect(0, 0, canvasAttributes.width, canvasAttributes.height);
    
    colorSource.forEach(colorPoint => {
      totalPixels++;

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

      let radiusPwr = radius * radius;

      for (let pixelX = startPixelX; pixelX < endPixelX ; pixelX++) {
        for (let pixelY = startPixelY; pixelY < endPixelY ; pixelY++) {
          let distPwr = powerOfDistance(pixelX, pixelY, colourCenterX, colourCenterY);
          
          // 1. SEE IF PIXEL IS IN RANGE
          if (distPwr < radiusPwr) {
            affectedPixels++;

            // 2. SEE IF COLOR FITS REQUIREMENT
            let index = xyToArrayIndex(pixelX, pixelY, canvasAttributes.width) * 4;
            let pixelColorRGB = [data[index], data[index + 1], data[index + 2]];

            // GET AND COMPARE COLOR IN HSL
            let pixelColorHSL = rgbToHsl(...pixelColorRGB);

            let hueDiff = Math.abs(targetHSL[0] - pixelColorHSL[0]);
            if (hueDiff > colorPoint.threshold.hue) { continue; }

            let satDiff = Math.abs(targetHSL[1] - pixelColorHSL[1]);
            if (satDiff > colorPoint.threshold.sat) { continue; }

            let briDiff = Math.abs(targetHSL[2] - pixelColorHSL[2]);
            if (briDiff > colorPoint.threshold.bri) { continue; }

            let pixelIndex = xyToArrayIndex(pixelX, pixelY, canvasAttributes.width)
            let alpha = lerp(255, 0, (distPwr / radiusPwr));

            let originalValue = newMask[pixelIndex] | 0;

            if (alpha > originalValue) {
                newMask[pixelIndex] = alpha;
                changePixelToColour(ctx, [alpha, alpha, alpha, 255], pixelX, pixelY)
            }
            }
          }
        }
      }
    )

    // console.log("UPDATE COLOR")
  }

  const toggleMaskDisplayMode = () => {
    if (matteMode === 3) setMatteMode(0)
    else setMatteMode(matteMode+1)
  }

  const handleAddButton = () => {
    // SET MODE --> ADD POINT
    editMode === 0 ? setEditMode(-1) : setEditMode(0);

    if (selectedPoint !== null) {
      if (colorSource.length === 0) {
        let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
        ctx.clearRect(0, 0, canvasAttributes.width, canvasAttributes.height);
      }

      // REMOVE POINT
      removeIndicator(selectedPoint);
    }
  }

  const deselectColourSample = () => {
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

  const removeIndicator = (selectedIndex) => {
    if (typeof selectedIndex !== "number") selectedIndex = parseInt(selectedIndex)
    setcolorSource(colorSource.filter((_, index) => (index !== selectedIndex)))
  }

  // LONG PRESS
  const onLongPress = (e) => {removeIndicator(e.target.getAttribute("data-index"))};
  const onClick = (e) => {setSelectedPoint(parseInt(e.target.getAttribute("data-index"))); setEditMode(1);}

  const defaultOptions = {shouldPreventDefault: true, delay: 500,};
  const longPressEvent = useLongPress(onLongPress, onClick, defaultOptions);

  // ELEMENTS 
  const SliderElement = () => {
    if (selectedPoint === null) return "";
    else if (selectedPoint > colorSource.length - 1) return ""

    const onChangeEvent = (e) => {
      
      // TODO : SET INDICATOR HOLDER REF . CURRENT TO FADE OUT
      indicatorHolderRef.current.classList.add("fade-away-now")

      if (editMode === 1) colorSource[selectedPoint].threshold.hue = e.target.value; 
      if (editMode === 2) colorSource[selectedPoint].threshold.sat = e.target.value; 
      if (editMode === 3) colorSource[selectedPoint].threshold.bri = e.target.value; 
      if (editMode === 4) colorSource[selectedPoint].threshold.radius = e.target.value; 
      
      // indicatorHolderRef.current.offsetWidth;

      updateMaskImage()
    }

    const getMinValue = () => (editMode === 4 ? 50 : 0.01)
    const getMaxValue = () => (editMode === 4 ? 500 : 1)
    const getStepValue = () => (editMode === 4 ? 10 : 0.01)

    const defaultValue = () => {
      if (editMode === 1) return colorSource[selectedPoint].threshold.hue
      if (editMode === 2) return colorSource[selectedPoint].threshold.sat
      if (editMode === 3) return colorSource[selectedPoint].threshold.bri
      if (editMode === 4) return colorSource[selectedPoint].threshold.radius
    };

    return <input type="range" ind={selectedPoint} key={editMode} className='left-row-btn range-toggle-slider ui-btn' min={`${getMinValue()}`} max={`${getMaxValue()}`} step={getStepValue()} onChange={onChangeEvent} defaultValue={defaultValue()}/>;
  }

  // STYLING
  const getAddButtonClass = () => {
    let classList = "ui-btn left-row-btn "

    if (selectedPoint !== null) {
      classList += "delete-btn "
    } else {
      classList += "add-color-sample-btn "

      if (editMode === 0) {
        classList += "btn-active "
      }
    }

    return classList;
  }

  const getMaskStyle = () => {
    const opacity = 0.8;
    if (matteMode === 0) return {display: "none"}
    else if (matteMode === 1) return {opacity: opacity, mixBlendMode: 'lighten'}
    else if (matteMode === 2) return {opacity: opacity, mixBlendMode: 'multiply'}
    else if (matteMode === 3) return {opacity: 0.9, mixBlendMode: 'normal'}
  }

  const getMatteMode = () => {
    if (matteMode === 0) return "hidden"
    else if (matteMode === 1) return "lighten"
    else if (matteMode === 2) return "multiply"
    else if (matteMode === 3) return "BW"
  }

  useEffect(() => {
    if (maskModeHintRef.current && canvasAttributes.width !== 0) {
      maskModeHintRef.current.classList.remove("fade-away");
      maskModeHintRef.current.offsetWidth;
      maskModeHintRef.current.classList.add("fade-away");
    }
  }, [matteMode])

  return (
    <div className="App">
      <div className="canvas-holder" data-image-direction={canvasHorizontal ? "horizontal" : "vertical"}>
          <div className="canvas-holder-inner" style={canvasAttributes ? {aspectRatio: `${canvasAttributes.width} / ${canvasAttributes.height}`} : {}}>
              <div className={canvasAttributes.width === 0 ? 'mask-mode-hint hidden' : "mask-mode-hint fade-away"} ref={maskModeHintRef}>{getMatteMode()}</div>
              <div className="indicator-holder" ref={indicatorHolderRef}>
                {colorSource.map((color, index) => {
                  let indicatorStyle = {
                    top: `${color.position[1] / canvasAttributes.height * 100}%`, 
                    left: `${color.position[0] / canvasAttributes.width * 100}%`,
                    backgroundColor: `hsl(${color.color[0] * 360}, ${color.color[1] * 100}%, ${color.color[2] * 100}%)`,
                  };
                  return <div className='indicator' {...longPressEvent} data-index={index} data-selected={selectedPoint === index ? "1" : "0"} key={index} style={indicatorStyle}></div>
                })}
              </div>
              <div className='canvas-interaction-holder' onClick={handleCanvasClicks}></div>
              <canvas className='matte-canvas' style={getMaskStyle()} ref={maskCanvasRef}></canvas>
              <Canvas src={imageSource} changeImageHolderDirection={changeImageHolderDirection} canvasAttributes={canvasAttributes} setCanvasAttributes={setCanvasAttributes} mainCanvasRef={mainCanvasRef} contextRef={mainContextRef}/>
          </div>
          <div className='blank-background' onClick={deselectColourSample}></div>
      </div>
      {imageSource !== "" ? <>
        <button className="left-row-btn show-hide-canvas-btn ui-btn" onClick={toggleMaskDisplayMode}>toggle mask</button>
        <button className={getAddButtonClass()} onClick={handleAddButton}>{selectedPoint !== null ? "REMOVE COLOR SAMPLE" : "ADD COLOR SAMPLE"}</button>
        {
          selectedPoint !== null ? <>
            <button className={editMode === 1 ? 'left-row-btn ui-btn toggle-hue-btn btn-active' : 'left-row-btn ui-btn toggle-hue-btn'} onClick={() => {setEditMode(1)}}>HUE</button>
            <button className={editMode === 2 ? 'left-row-btn ui-btn toggle-sat-btn btn-active' : 'left-row-btn ui-btn toggle-sat-btn'} onClick={() => {setEditMode(2)}}>SAT</button>
            <button className={editMode === 3 ? 'left-row-btn ui-btn toggle-bri-btn btn-active' : 'left-row-btn ui-btn toggle-bri-btn'} onClick={() => {setEditMode(3)}}>BRI</button>
            <button className={editMode === 4 ? 'left-row-btn ui-btn toggle-rad-btn btn-active' : 'left-row-btn ui-btn toggle-rad-btn'} onClick={() => {setEditMode(4)}}>RADIUS</button>
            <SliderElement/>
          </> : ""
        }
      </> : ""}
      <button onClick={() => {setImageSource("./img.jpg")}} className='open-file-btn right-row-btn ui-btn'>OPEN FILE</button>
      <button onClick={() => {downloadCanvasAsJPEG(mainCanvasRef.current)}} className='right-row-btn ui-btn download-btn'>download as jpg</button>
    </div>
  )
}

export default App
