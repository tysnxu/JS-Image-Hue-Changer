import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import {rgbToHsl, hslToRgb, shiftHue} from "./components/colorConversion"
import {xyToArrayIndex, indexToXY, powerOfDistance, inRange, lerp, midPoint, getDistance} from "./components/coordinateCalc"
import {downloadCanvasAsJPEG} from "./components/fileIO"

import useLongPress from "./components/useLongPress";  // REMOVES THE COLOUR INDICATOR WHEN LONG PRESSED

function App() {
  const [colorSource, setColorSource] = useState([])
  var colorSourceID = useRef(0);
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
  const [imageFile, setImageFile] = useState();

  const [matteMode, setMatteMode] = useState(2); // 0: HIDDEN | 1: LIGHTEN | 2 : MULTIPLY | 3 : NORMAL (BW)
  const [editMode, setEditMode] = useState(0)  // -1: NO INTERACTION | 0: ADD | 1: CHANGE HUE | 2: CHANGE SATURATION | 3: CHANGE BRIGHTNESS | 4. CHANGE RADIUS | 5. CHANGE SHIFTED HUE
  const [hueShift, setHueShift] = useState(221);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showIndicator, setShowIndicator] = useState(true);
  const [showRender, setShowRender] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [canvasTransform, setCanvasTransform] = useState({scale: 1, xOffset: 0, yOffset: 0});

  const mainCanvasRef = useRef(null);
  const mainContextRef = useRef(null);
  const maskCanvasRef = useRef(null);

  const maskModeHintRef = useRef();
  const indicatorHolderRef = useRef();

  const canvasImageRef = useRef(new Image());
  const imageDownScaleFactor = 4;  // SCALE DOWN THE IMAGE/CANVAS TO PRESERVE MEMORY

  useEffect(() => {
    if (canvasAttributes.width !== 0) {
      updateMaskImage()
      if (colorSource.length !== 0) {
        setSelectedPoint(colorSource[colorSource.length-1].id)
      } else {
        setEditMode(0);
        setSelectedPoint(null);
      }
  }}, [colorSource])

  useEffect(() => {if (canvasAttributes.width !== 0 && selectedPoint !== null && editMode <= 1) {
    setEditMode(1)
  }}, [selectedPoint])

  useEffect(() => {
    if (showRender === false) return;
    renderFinalImage()
  }, [showRender, colorSource, hueShift]);

  useEffect(() => {
    if (showPreview === false) return;
    updatePreviewImage();
  }, [showPreview, colorSource, hueShift]);

  const imageOnLoad = () => {
    let canvasImage = canvasImageRef.current;

    // Get the size of the image
    let imageWidth = canvasImage.naturalWidth;
    let imageHeight = canvasImage.naturalHeight;

    imageWidth = Math.floor(imageWidth / imageDownScaleFactor);
    imageHeight = Math.floor(imageHeight / imageDownScaleFactor);

    let imageAspectRatio = imageWidth / imageHeight;

    console.log(`OPENING IMAGE: ${imageWidth} / ${imageHeight}`)
    
    // Set the size of the canvas to match the image size
    mainCanvasRef.current.width = imageWidth;
    mainCanvasRef.current.height = imageHeight;
    document.querySelector(".matte-canvas").width = imageWidth;
    document.querySelector(".matte-canvas").height = imageHeight;
    document.querySelector(".preview-canvas").width = imageWidth;
    document.querySelector(".preview-canvas").height = imageHeight;

    // Draw the scaled-down image onto the canvas
    mainContextRef.current.drawImage(canvasImage, 0, 0, imageWidth, imageHeight);
    
    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, imageWidth, imageHeight);

    setCanvasAttributes({
      width: imageWidth,
      height: imageHeight,
      ratio: imageAspectRatio,
    });

    changeImageHolderDirection(imageAspectRatio);

    window.addEventListener('resize', () => {changeImageHolderDirection(imageAspectRatio)});
  }

  useEffect(() => {
    mainContextRef.current = mainCanvasRef.current.getContext('2d', {willReadFrequently : true});
    canvasImageRef.current.onload = imageOnLoad;
  }, []);

  const renderFinalImage = useCallback(() => {
    if (canvasImageRef.current === null) return;
    let finalCanvas = document.querySelector(".final-render-canvas");

    if (finalCanvas === null) return;
    
    let origImageWidth = canvasImageRef.current.naturalWidth;
    let origImageHeight = canvasImageRef.current.naturalHeight;

    let ctx = finalCanvas.getContext('2d', {willReadFrequently : true});

    finalCanvas.width = origImageWidth;
    finalCanvas.height = origImageHeight;
    ctx.drawImage(canvasImageRef.current, 0, 0, origImageWidth, origImageHeight);

    // GET ALL PIXEL COLOUR
    var imageData = ctx.getImageData(0, 0, origImageWidth, origImageHeight);
    var data = imageData.data;
    
    colorSource.forEach(colorPoint => {
      let targetHSL = colorPoint.color;

      // GET COLOUR ORIGIN
      let colourCenterX = Math.floor(colorPoint.position[0] / canvasAttributes.width * origImageWidth);
      let colourCenterY = Math.floor(colorPoint.position[1] / canvasAttributes.height * origImageHeight);
      let radius = Math.floor(colorPoint.threshold.radius / canvasAttributes.width * origImageWidth);
      
      // SHOULD NOT EXCEED LEFT RIGHT BOUNDAIES
      let startPixelX = Math.max(colourCenterX - radius - 1, 0);
      let endPixelX = Math.min(colourCenterX + radius + 1, origImageWidth);

      // SHOULD NOT EXCEED TOP BOTTOM BOUNDAIES
      let startPixelY = Math.max(colourCenterY - radius - 1, 0);
      let endPixelY = Math.min(colourCenterY + radius + 1, origImageHeight);

      let radiusPwr = radius * radius;

      for (let pixelX = startPixelX; pixelX < endPixelX ; pixelX++) {
        for (let pixelY = startPixelY; pixelY < endPixelY ; pixelY++) {
          let distPwr = powerOfDistance(pixelX, pixelY, colourCenterX, colourCenterY);
          
          // 1. SEE IF PIXEL IS IN RANGE
          if (distPwr < radiusPwr) {
            // GET PIXEL INDEX
            let index = xyToArrayIndex(pixelX, pixelY, origImageWidth) * 4;

            // 2. SEE IF COLOR FITS REQUIREMENT
            let pixelColorRGB = [data[index], data[index + 1], data[index + 2]];

            // GET AND COMPARE COLOR IN HSL
            let pixelColorHSL = rgbToHsl(...pixelColorRGB);

            let hueDiff = Math.abs(targetHSL[0] - pixelColorHSL[0]);
            if (hueDiff > colorPoint.threshold.hue) { continue; }

            let satDiff = Math.abs(targetHSL[1] - pixelColorHSL[1]);
            if (satDiff > colorPoint.threshold.sat) { continue; }

            let briDiff = Math.abs(targetHSL[2] - pixelColorHSL[2]);
            if (briDiff > colorPoint.threshold.bri) { continue; }

            // let alpha = lerp(255, 100, (distPwr / radiusPwr));

            let shiftedHue = shiftHue(pixelColorHSL[0], pixelColorHSL[1], pixelColorHSL[2], hueShift);
            let shiftedRGB = hslToRgb(...shiftedHue);

            changePixelToColour(ctx, [shiftedRGB[0], shiftedRGB[1], shiftedRGB[2], 255], pixelX, pixelY)
            }
          }
        }
      }
    )
  }, [colorSource, hueShift])
  
  const updateMaskImage = useCallback(() => {
    if (canvasAttributes.width === 0) return false

    // GET ALL PIXEL COLOUR
    var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    var data = imageData.data;

    var newMask = new Array(canvasAttributes.width * canvasAttributes.height);

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});

    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, 255)";
    ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);
    // ctx.clearRect(0, 0, canvasAttributes.width, canvasAttributes.height);
    
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

      let radiusPwr = radius * radius;

      for (let pixelX = startPixelX; pixelX < endPixelX ; pixelX++) {
        for (let pixelY = startPixelY; pixelY < endPixelY ; pixelY++) {
          let distPwr = powerOfDistance(pixelX, pixelY, colourCenterX, colourCenterY);
          
          // 1. SEE IF PIXEL IS IN RANGE
          if (distPwr < radiusPwr) {
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
            let alpha = lerp(255, 100, (distPwr / radiusPwr));

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

  }, [colorSource])

  const updatePreviewImage = useCallback(() => {
    if (canvasAttributes.width === 0) return false

    // GET ALL PIXEL COLOUR
    var imageData = mainContextRef.current.getImageData(0, 0, canvasAttributes.width, canvasAttributes.height);
    var data = imageData.data;

    // FILLING THE CANVAS --> THIS MAKES THE PIXEL UPDATING WAY FASTER THAN WITH THE IMAGE NOT INITIALIZED
    let ctx = document.querySelector(".preview-canvas").getContext('2d', {willReadFrequently : true});

    // ctx.beginPath();
    // ctx.fillStyle = "rgba(0, 0, 0, 255)";
    // ctx.fillRect(0, 0, canvasAttributes.width, canvasAttributes.height);
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

      let radiusPwr = radius * radius;

      for (let pixelX = startPixelX; pixelX < endPixelX ; pixelX++) {
        for (let pixelY = startPixelY; pixelY < endPixelY ; pixelY++) {
          let distPwr = powerOfDistance(pixelX, pixelY, colourCenterX, colourCenterY);
          
          // 1. SEE IF PIXEL IS IN RANGE
          if (distPwr < radiusPwr) {
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

            // let pixelIndex = xyToArrayIndex(pixelX, pixelY, canvasAttributes.width)
            // let alpha = lerp(255, 100, (distPwr / radiusPwr));

            let shiftedHue = shiftHue(pixelColorHSL[0], pixelColorHSL[1], pixelColorHSL[2], hueShift);
            let shiftedRGB = hslToRgb(...shiftedHue);

            changePixelToColour(ctx, [shiftedRGB[0], shiftedRGB[1], shiftedRGB[2], 255], pixelX, pixelY)
            }
          }
        }
      }
    )

    // console.log("UPDATE COLOR")

  }, [colorSource, hueShift])

  const chooseImage = () => {
    document.getElementById("image-uploader").click();
  }

  const changeImageHolderDirection = (imageRatio) => {
    var windowRatio = window.innerWidth / window.innerHeight;

    if (imageRatio > windowRatio) {
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

  const deselectColourSample = () => {
    setSelectedPoint(null);
    setEditMode(-1);
  }

  const getTouchPosition = (e) => {
      // DUE TO THE CANVAS BEING SCALED BY CSS
      // GETTING THE REAL SIZE IS REQUIRED BEFORE DETERMINING THE MOUSE CLICK
      var rect = document.querySelector(".main-canvas").getBoundingClientRect();

      let realWidth = rect.width;
      let realHeight = rect.height;

      let clickXWithoutScale;
      let clickYWithoutScale;

      if (e.type === "touchend") {
        // MOBILE CLICK
        clickXWithoutScale = e.changedTouches[0].clientX - rect.left;
        clickYWithoutScale = e.changedTouches[0].clientY - rect.top;
      } else if (e.type === "click") {
        // DESKTOP CLICK
        console.log(e)
        clickXWithoutScale = e.clientX - rect.left;
        clickYWithoutScale = e.clientY - rect.top;
      } else {
        throw new Error("Unknown event type");
      }

      if (clickXWithoutScale > 0 && clickYWithoutScale > 0 && clickXWithoutScale < realWidth && clickYWithoutScale < realHeight) {
        let touchX = Math.floor(clickXWithoutScale * (canvasAttributes.width / realWidth));
        let touchY = Math.floor(clickYWithoutScale * (canvasAttributes.height / realHeight));
  
        return {touchX, touchY}
      } else {
        console.log("Out of bound")
        throw new Error("Out of bound");
      }
  }

  const addIndicator = (x, y, colorRGB) => {
      let colorHSL = rgbToHsl(...colorRGB);

      let newID = colorSourceID.current++;

      setColorSource([...colorSource,
          {
            id: newID,
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

      if (!showIndicator) {setShowIndicator(true)};
  }

  const removeIndicator = (selectedIndex) => {
    if (typeof selectedIndex !== "number") selectedIndex = parseInt(selectedIndex)
    setColorSource(colorSource.filter((value) => (value.id !== selectedIndex)))
    setSelectedPoint(null);
  }

  // EVENTS
  const handleChooseImage = (e) => {
    if (e.target.files[0]) {
      let imageAsURL = URL.createObjectURL(e.target.files[0]);
      canvasImageRef.current.src = imageAsURL;
      setImageFile(imageAsURL);
      setColorSource([]);
    } else {
      console.log("DID NOT SELECT IMAGE.")
    }
  }

  const renderButtonEvent = (e) => {
    e.stopPropagation();

    setShowRender(showRender => {
      let newMode = !showRender;

      if (newMode === true) {
        setShowIndicator(false)  // HIDE INDICATOR
        setMatteMode(0)  // HIDE MASK
      } else {
        downloadCanvasAsJPEG(document.querySelector(".final-render-canvas"))
      }
      return newMode;
    });
  }
  
  const togglePreview = () => {
    setShowPreview(showPreview => {
      let newMode = !showPreview;

      // IF ENABLING PREVIEW
      if (newMode === true) {
        setShowIndicator(false)  // HIDE INDICATOR
        setShowRender(false)  // HIDE FINAL RENDER
        setMatteMode(0)  // HIDE MASK
      } else {
        setShowIndicator(true)  // SHOW INDICATOR
        setMatteMode(2)  // HIDE MASK
      }
      return newMode;
    });
  }
  
  const handleAddButton = (e) => {
    if (editMode === -1) setShowIndicator(true);

    // SET MODE --> ADD POINT
    editMode === 0 ? setEditMode(-1) : setEditMode(0);
    
    if (showPreview) {setShowPreview(false)}
    if (showRender) {setShowRender(false)}

    // SELECTED POINT --> DELETE MODE
    if (selectedPoint !== null) {
      if (colorSource.length === 0) {
        let ctx = document.querySelector(".matte-canvas").getContext('2d', {willReadFrequently : true});
        ctx.clearRect(0, 0, canvasAttributes.width, canvasAttributes.height);
      }

      // REMOVE POINT
      removeIndicator(selectedPoint);
    }
  }

  const toggleMaskDisplayMode = () => {
    if (showPreview) {setShowPreview(false)}
    if (showRender) {setShowRender(false)}

    if (matteMode === 3) setMatteMode(0)
    else setMatteMode(matteMode+1)
  }

  const handleRenderCanvasClick = () => {
    if (showRender) {setShowRender(false)}
  }

  const handlePreviewCanvasClick = () => {
    if (showPreview) {setShowPreview(false)}
  }

  const handleCanvasClick = (e) => {
    // console.log(e)
    handleCanvasTap(e);
  }

  // ADD LISTENERS FOR MOVING CANVAS
  useEffect(() => {
    document.querySelector(".canvas-mover-layer").addEventListener("touchstart", handleCanvasTouchStart)
  }, [])

  const handleCanvasTap = (e) => {
    if (showRender) {setShowRender(false); return;};
    if (showPreview) {setShowPreview(false); return;}
    if (editMode > 0) {deselectColourSample(); return;}

    if (editMode === 0) {
      try {
        let {touchX, touchY} = getTouchPosition(e);

        // Get the pixel color data at the clicked point
        var pixelData = mainContextRef.current.getImageData(touchX, touchY, 1, 1).data;
    
        // Get the RGB color values from the pixel data
        var red = pixelData[0];
        var green = pixelData[1];
        var blue = pixelData[2];
    
        if (canvasAttributes.ratio !== 0) {
          addIndicator(touchX, touchY, [red, green, blue]);
        }
    
        // Display the color in the console
        console.log(`Clicked color: rgb(${red}, ${green}, ${blue}) @ [${touchX}, ${touchY}]`);
      } catch (e) {
        console.log(e)
        return ;
      }
    }
  }

  const handleCanvasTouchStart = (e) => {
    e.preventDefault();

    if (e.touches.length !== 1) {
      e.target.removeAttribute("data-initial-touch")
    } else {
      e.target.setAttribute("data-initial-touch", `${e.touches[0].clientX}, ${e.touches[0].clientY}`)
    }
  }

  const handleCanvasTouchMove = (e) => {
    if (e.touches.length === 1) {
      let touch = e.touches[0];

      if (e.target.getAttribute("data-touch-x")) {
        let lastTouchX = e.target.getAttribute("data-touch-x");
        let lastTouchY = e.target.getAttribute("data-touch-y");

        // CONTROL SLIDER
        if (editMode > 0) {
          let slider = document.querySelector(".range-toggle-slider");
          let startTouchX;

          if (slider && e.target.getAttribute("data-initial-touch")) {
            startTouchX = parseFloat(e.target.getAttribute("data-initial-touch").split(", ")[0]);

            let value = getSliderDefaultValue();
            let step = parseFloat(slider.step);
            let min = parseFloat(slider.min);
            let max = parseFloat(slider.max);
  
            let stepsChanged = parseInt((touch.clientX - startTouchX) / 20)
            let newValue = Math.min(max, Math.max(min, value + step * stepsChanged));

            if (newValue == value) return;
  
            if (editMode === 5) {
              setHueShift(newValue);
            } else {
              const newColourSource = colorSource.map((value, index) => {
                if (value.id === selectedPoint) {
                  if (editMode === 1) value.threshold.hue = newValue; 
                  else if (editMode === 2) value.threshold.sat = newValue; 
                  else if (editMode === 3) value.threshold.bri = newValue; 
                  else if (editMode === 4) value.threshold.radius = newValue; 
                }
  
                return value;
              });
  
              setColorSource(newColourSource);
            }
          }
        } else {
          setCanvasTransform(canvasTransform => {
            return {
              ...canvasTransform,
              xOffset: canvasTransform.xOffset + ((touch.clientX - lastTouchX) * (1 / canvasTransform.scale)),
              yOffset: canvasTransform.yOffset + ((touch.clientY - lastTouchY) * (1 / canvasTransform.scale)),
            }
          });
        }

        let touchForce = parseInt(e.touches[0].radiusX * e.touches[0].radiusY);
        if (touchForce > 10) {setCanvasTransform({scale: 1, xOffset: 0, yOffset: 0});}
      }

      e.target.setAttribute("data-touch-x", touch.clientX);
      e.target.setAttribute("data-touch-y", touch.clientY);
    } else if (e.touches.length === 2) {
      // ZOOMING
      let point1Pos;
      let point2Pos;

      [...e.touches].forEach(touch => {
        if (touch.identifier === 0) point1Pos = [touch.clientX, touch.clientY]
        else if (touch.identifier === 1) point2Pos = [touch.clientX, touch.clientY]
      })

      if (point1Pos === undefined || point2Pos === undefined) return;

      let touchDistance = getDistance(point1Pos[0], point1Pos[1], point2Pos[0], point2Pos[1]);
      let middlePoint = midPoint(point1Pos[0], point1Pos[1], point2Pos[0], point2Pos[1]);

      let previousDistance = e.target.getAttribute("data-base-distance");
      let previousMidPointX = e.target.getAttribute("data-zoom-midpoint-x");
      let previousMidPointY = e.target.getAttribute("data-zoom-midpoint-y");

      if (previousDistance && previousMidPointX) {
        let scaleChange = (touchDistance - parseFloat(previousDistance)) / 500;

        let positionChangeX = middlePoint[0] - previousMidPointX;
        let positionChangeY = middlePoint[1] - previousMidPointY;

        setCanvasTransform(canvasTransform => ({
          ...canvasTransform,
          scale: Math.max(0.45, canvasTransform.scale + scaleChange * canvasTransform.scale),
          xOffset: canvasTransform.xOffset + (positionChangeX * (1 / canvasTransform.scale)),
          yOffset: canvasTransform.yOffset + (positionChangeY * (1 / canvasTransform.scale)),
        }))
      }

      e.target.setAttribute("data-base-distance", touchDistance);
      e.target.setAttribute("data-zoom-midpoint-x", middlePoint[0]);
      e.target.setAttribute("data-zoom-midpoint-y", middlePoint[1]);
    }
  }

  const handleCanvasTouchEnd = (e) => {
    e.target.removeAttribute("data-touch-x");
    e.target.removeAttribute("data-touch-y");
    e.target.removeAttribute("data-base-distance");
    e.target.removeAttribute("data-zoom-midpoint-x");
    e.target.removeAttribute("data-zoom-midpoint-y");

    if (e.target.getAttribute("data-initial-touch") && e.touches.length === 0) {
      let [startX, startY] = e.target.getAttribute("data-initial-touch").split(", ");
      e.target.removeAttribute("data-initial-touch");

      let endX = e.changedTouches[0].clientX;
      let endY = e.changedTouches[0].clientY;

      let totalDiff = (parseFloat(startX) - endX) + parseFloat(startY) - endY;

      if ((totalDiff * totalDiff) < 3 && canvasAttributes.ratio !== 0) {
        // THIS IS A TAP
        handleCanvasTap(e)
      }
    }
  }

  // LONG PRESS
  const onLongPress = (e) => {removeIndicator(e.target.getAttribute("data-index"))};
  const onTouchEnd = (e) => {setSelectedPoint(parseInt(e.target.getAttribute("data-index"))); setEditMode(1);}

  const defaultOptions = {shouldPreventDefault: true, delay: 500,};
  const longPressEvent = useLongPress(onLongPress, onTouchEnd, defaultOptions);

  const getSliderDefaultValue = () => {
    if (editMode === 5) return hueShift;

    let value;
    [...colorSource].forEach(color => {
      if (value) return;

      if (color.id === selectedPoint) {
        if (editMode === 1) {value = color.threshold.hue; return;}
        else if (editMode === 2) {value = color.threshold.sat; return;} 
        else if (editMode === 3) {value = color.threshold.bri; return;}
        else if (editMode === 4) {value = color.threshold.radius; return;}
      }
    })

    return value;
  }

  // ELEMENTS 
  const SliderElement = () => {
    if (selectedPoint === null && editMode !== 5) {return ""}

    const onChangeEvent = (e) => {
      if (editMode === 5) {
        setHueShift(e.target.value);
      } else {
        const newColourSource = colorSource.map((value, index) => {
          if (value.id === selectedPoint) {
            if (editMode === 1) value.threshold.hue = e.target.value; 
            else if (editMode === 2) value.threshold.sat = e.target.value; 
            else if (editMode === 3) value.threshold.bri = e.target.value; 
            else if (editMode === 4) value.threshold.radius = e.target.value; 
          }

          return value;
        });

        setColorSource(newColourSource);
      }

      updateMaskImage()
    }

    const getMinValue = () => {
      if (editMode === 4) {return 50;}
      else if (editMode === 5) {return 1;}
      else {return 0.01;}
    }

    const getMaxValue = () => {
      if (editMode === 4) {return 500;}
      else if (editMode === 5) {return 360;}
      else {return 1;}
    }

    const getStepValue = () => {
      if (editMode === 4) {return 10;}
      else if (editMode === 5) {return 5;}
      else {return 0.01;}
    }

    return <input type="range" ind={selectedPoint} key={editMode} className='range-toggle-slider' min={`${getMinValue()}`} max={`${getMaxValue()}`} step={getStepValue()} onChange={onChangeEvent} defaultValue={getSliderDefaultValue()}/>;
  }

  // STYLING
  const getAddButtonMode = () => {
    if (selectedPoint !== null) {
      return "delete"
    } else {
      if (editMode === 0) {
        return "add"
      }

      return ""
    }
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

  const canvasTransformStyle = {scale: `${canvasTransform.scale}`, transform: `translate(${canvasTransform.xOffset}px, ${canvasTransform.yOffset}px)`}

  useEffect(() => {
    if (maskModeHintRef.current && canvasAttributes.width !== 0) {
      maskModeHintRef.current.classList.remove("fade-away");
      maskModeHintRef.current.offsetWidth;
      maskModeHintRef.current.classList.add("fade-away");
    }
  }, [matteMode])

  return (
    <div className="App">
      {imageFile === undefined ? <div className='start-hint'>{"Start by opening an image -->"}</div> : ""}
      <div className='left-side-bar'>
        <div className='logo-container'>
          <img src="./icons/logo.svg" alt="" />
        </div>

        {imageFile !== undefined ? <>
          <div className='single-btn-group' id='add-btn-group' onClick={handleAddButton} data-mode={getAddButtonMode()}>
            <img className='img-btn' src={selectedPoint !== null ? "./icons/delete.svg" : "./icons/plus.svg"} alt="" />
          </div>

          {selectedPoint === null ? "" : 
            <div className='multi-btn-group'>
              <img className='add-btn letter-btn' src="./icons/letters/H.svg" alt="" onClick={() => {setEditMode(1)}} data-toggle={editMode === 1 ? "on" : "off"} />
              <img className='add-btn letter-btn' src="./icons/letters/S.svg" alt="" onClick={() => {setEditMode(2)}} data-toggle={editMode === 2 ? "on" : "off"} />
              <img className='add-btn letter-btn' src="./icons/letters/L.svg" alt="" onClick={() => {setEditMode(3)}} data-toggle={editMode === 3 ? "on" : "off"} />
              <div className='multi-btn-group--divider'></div>
              <img className='add-btn letter-btn' src="./icons/letters/R.svg" alt="" onClick={() => {setEditMode(4)}} data-toggle={editMode === 4 ? "on" : "off"} />
              <SliderElement />
            </div>
          }

          <div className='single-btn-group' style={editMode === 5 ? {background: "black"} : {}} onClick={() => {setEditMode(5)}} >
            <img className='color-switch-btn img-btn' src={editMode === 5 ? "./icons/color-switch-invert.svg" : "./icons/color-switch.svg"} alt="" />
            {selectedPoint === null ? <SliderElement /> : ""}
          </div>
        </> : ""}
      </div>
      
      <div className='right-side-bar'>
        <div className='multi-btn-group' onClick={chooseImage} >
          <img className='open-file-btn img-btn' src="./icons/open.svg" alt=""/>
          {imageFile !== undefined ? <img className='open-file-btn img-btn' style={showRender ? {} : {opacity: 0.2}} src="./icons/download.svg" alt="" onClick={renderButtonEvent} /> : ""}
        </div>
        
        {imageFile !== undefined ? <>
          <div className='single-btn-group' id='mask-mode-btn-group' onClick={toggleMaskDisplayMode} data-mode={matteMode}>
            <img className='img-btn' src="./icons/mask-mode.svg" alt=""/>
          </div>
          <div className='single-btn-group' onClick={togglePreview} data-toggle={showPreview ? "on" : "off" } >
            <img className='show-preview-btn img-btn' src="./icons/show-preview.svg" alt=""/>
          </div>
          <div className='single-btn-group' onClick={() => {setShowIndicator(!showIndicator)}} data-toggle={showIndicator ? "on" : "off" }>
            <img className='mask-mode-btn img-btn' src="./icons/indicator.svg" alt=""/>
          </div>
        </> : ""}
      </div>

      <div className="indicator-holder-outer" style={canvasTransformStyle} data-image-direction={canvasHorizontal ? "horizontal" : "vertical"}>
        <div className={showIndicator ? "indicator-holder" : "indicator-holder hidden"} style={canvasAttributes ? {aspectRatio: `${canvasAttributes.width} / ${canvasAttributes.height}`} : {}} ref={indicatorHolderRef}>
          {colorSource.map((color, index) => {
            let indicatorStyle = {
              top: `${color.position[1] / canvasAttributes.height * 100}%`, 
              left: `${color.position[0] / canvasAttributes.width * 100}%`,
              backgroundColor: `hsl(${color.color[0] * 360}, ${color.color[1] * 100}%, ${color.color[2] * 100}%)`,
            };
            return <div className='indicator' {...longPressEvent} data-index={color.id} data-selected={selectedPoint === color.id ? "1" : "0"} key={color.id} style={indicatorStyle}></div>
          })}
        </div>
      </div>
      <div className='canvas-mover-layer' onClick={handleCanvasClick} onTouchMove={handleCanvasTouchMove} onTouchCancel={handleCanvasTouchEnd} onTouchEnd={handleCanvasTouchEnd}></div>
      <div className="canvas-holder" style={canvasTransformStyle} data-image-direction={canvasHorizontal ? "horizontal" : "vertical"}>
        <div className="canvas-holder-inner" style={canvasAttributes ? {aspectRatio: `${canvasAttributes.width} / ${canvasAttributes.height}`} : {}}>
            <canvas className={showRender ? 'final-render-canvas' : 'final-render-canvas hidden'} onTouchEnd={handleRenderCanvasClick}></canvas>
            <canvas className={showPreview ? 'preview-canvas' : 'preview-canvas hidden'} onTouchEnd={handlePreviewCanvasClick}></canvas>
            <div className={canvasAttributes.width === 0 ? 'mask-mode-hint hidden' : "mask-mode-hint fade-away"} ref={maskModeHintRef}>{getMatteMode()}</div>
            <canvas className='matte-canvas' style={getMaskStyle()} ref={maskCanvasRef}></canvas>
            <canvas className='main-canvas' ref={mainCanvasRef}/>
        </div>
      </div>
      <input type="file" accept="image/png, image/jpeg" id='image-uploader' onChange={handleChooseImage} className='hidden' />
    </div>
  )
}

export default App
