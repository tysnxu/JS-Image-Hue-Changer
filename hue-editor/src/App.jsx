import { useEffect, useState } from 'react'
import './App.css'

import {rgbToHsl, hslToRgb, shiftHue} from "./components/colorConversion"
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
  
  const changeImageHolderDirection = () => {
    var windowRatio = window.innerWidth / window.innerHeight;

    if (canvasAttributes.ratio > windowRatio) {
        setCanvasHorizontal(true)
    } else {
        setCanvasHorizontal(false)
    }
  }

  useEffect(()=> {window.addEventListener('resize', changeImageHolderDirection)}, [canvasAttributes])

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
              <Canvas src={imageSource} changeImageHolderDirection={changeImageHolderDirection} canvasAttributes={canvasAttributes} setCanvasAttributes={setCanvasAttributes} setcolorSource={setcolorSource} colorSource={colorSource}/>
          </div>
      </div>
      <button className="plus-btn">+{colorSource.length}</button>
      <button className="minus-btn">-</button>
      <button onClick={() => {setImageSource("./img.jpg")}} className='open-file-btn'>OPEN FILE</button>
      <button onClick={downloadCanvasAsJPEG}>download as jpg</button>
      <button>SHOW MATTE</button>
    </div>
  )
}

export default App
