const indicatorHolderElement = document.querySelector(".indicator-holder");
const canvasHolder = document.querySelector(".canvas-holder")

// // Get the canvas element and context
// const canvas = document.getElementById("myCanvas");
// var ctx = canvas.getContext("2d", {willReadFrequently : true});

// var showMatte = false;
// var showVisualizer = true;

// var currentHolderDirection = "horizontal";

// Create a new image object
// var img = new Image();

// Set the source of the image
// img.src = "./img.jpg";
// img.src = "./2.jpg";

// var imageWidth;
// var imageHeight;
// var imageAspectRatio;

var sampledColors = [[212, 188, 138]];

// var colorSource = []

// {  // SAMPLE FOR COLOR SOURCE
//     position: [1, 2],
//     color: [0.1, 0.1, 0.1],
//     threshold: {
//         hue: 0.1,
//         sat: 0.1,
//         bri: 0.1,
//         radius: 20,  // IN PIXELS
//     }
// }

// var maskIMG = new Array();

// // Function to convert RGB to HSL (FROM 0 - 255)
// const rgbToHsl = (r, g, b) => {
//     r /= 255;
//     g /= 255;
//     b /= 255;
//     var max = Math.max(r, g, b), min = Math.min(r, g, b);
//     var h, s, l = (max + min) / 2;
//     if (max == min) {
//         h = s = 0; // achromatic
//     } else {
//         var d = max - min;
//         s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
//         switch (max) {
//             case r: h = (g - b) / d + (g < b ? 6 : 0); break;
//             case g: h = (b - r) / d + 2; break;
//             case b: h = (r - g) / d + 4; break;
//         }
//         h /= 6;
//     }
//     return [h, s, l];
// }

// // Function to convert HSL to RGB (FROM 0 - 1)
// const hslToRgb = (h, s, l) => {
//     var r, g, b;
  
//     if (s == 0) {
//       r = g = b = l; // achromatic
//     } else {
//       var hue2rgb = function hue2rgb(p, q, t) {
//         if (t < 0) t += 1;
//         if (t > 1) t -= 1;
//         if (t < 1 / 6) return p + (q - p) * 6 * t;
//         if (t < 1 / 2) return q;
//         if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
//         return p;
//       }
  
//       var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
//       var p = 2 * l - q;
  
//       r = hue2rgb(p, q, h + 1 / 3);
//       g = hue2rgb(p, q, h);
//       b = hue2rgb(p, q, h - 1 / 3);
//     }
  
//     return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
// }

// const toggleMatte = () => {
//     showMatte = !showMatte;
// }

// const shiftHue = (h, s, l) => {
//     return [1, 1, 1]
//     return [1-h, s, l]
// }

const getUpdatedImageData = () => {
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;

    targetHSL = rgbToHsl(...sampledColors[0])

    totalCounter = 0
    changedCounter = 0

    //Read image and make changes on the fly as it's read  
    for (i = 0; i < data.length; i += 4) 
    {
        totalCounter++;
        let r = imageData.data[i];
        let g = imageData.data[i+1];
        let b = imageData.data[i+2];
        let colorHSL = rgbToHsl(r, g, b)

        let hueDiff = Math.abs(targetHSL[0] - colorHSL[0]);
        let satDiff = Math.abs(targetHSL[1] - colorHSL[1]);
        let briDiff = Math.abs(targetHSL[2] - colorHSL[2]);

        if (hueDiff < 0.1 && satDiff < 0.1 && briDiff < 0.1) {
            changedCounter++
            let newHSL = shiftHue(...colorHSL)
            let newRGB = hslToRgb(...newHSL)

            // if (changedCounter < 5) {
            //     console.log(newHSL)
            //     console.log(colorHSL)
            //     console.log(newRGB)
            //     console.log("--------------")
            // }
            
            imageData.data[i] = newRGB[0]
            imageData.data[i+1] = newRGB[1]
            imageData.data[i+2] = newRGB[2]
        }
    } 

    console.log(`${changedCounter} OUT OF ${totalCounter}`)

    return imageData
}

const updateMatte = () => {
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;

    targetHSL = rgbToHsl(...sampledColors[0])

    totalCounter = 0
    changedCounter = 0

    //Read image and make changes on the fly as it's read  
    for (i = 0; i < data.length; i += 4) 
    {
        totalCounter++;
        let r = imageData.data[i];
        let g = imageData.data[i+1];
        let b = imageData.data[i+2];
        let colorHSL = rgbToHsl(r, g, b)

        let hueDiff = Math.abs(targetHSL[0] - colorHSL[0]);
        let satDiff = Math.abs(targetHSL[1] - colorHSL[1]);
        let briDiff = Math.abs(targetHSL[2] - colorHSL[2]);

        if (hueDiff < 0.1 && satDiff < 0.1 && briDiff < 0.1) {
            changedCounter++
            let newHSL = shiftHue(...colorHSL)
            let newRGB = hslToRgb(...newHSL)

            // if (changedCounter < 5) {
            //     console.log(newHSL)
            //     console.log(colorHSL)
            //     console.log(newRGB)
            //     console.log("--------------")
            // }
            
            imageData.data[i] = newRGB[0]
            imageData.data[i+1] = newRGB[1]
            imageData.data[i+2] = newRGB[2]
        }
    } 

    console.log(`${changedCounter} OUT OF ${totalCounter}`)

    return imageData
}

// const downloadCanvasAsJPEG = () => {
//     // Convert the canvas to a base64-encoded JPEG image
//     var dataURL = canvas.toDataURL("image/jpeg");

//     // Create a download link for the image file
//     var downloadLink = document.createElement("a");
//     downloadLink.href = dataURL;
//     downloadLink.download = "myImage.jpg"; // Set the filename of the downloaded file
//     document.body.appendChild(downloadLink);
//     downloadLink.click();
//     document.body.removeChild(downloadLink);
// }

// const loadImage = (event) => {
//     file = event.target.files[0];
//     const reader = new FileReader();
  
//     reader.onload = function(e) {
//       img.onload = function() {
//         // Get the size of the image
//         imageWidth = img.naturalWidth;
//         imageHeight = img.naturalHeight;
//         imageAspectRatio = imageWidth / imageHeight;

//         changeImageHolderDirection()
        
//         // Set the size of the canvas to match the image size
//         canvas.width = imageWidth;
//         canvas.height = imageHeight;

//         // Draw the scaled-down image onto the canvas
//         ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
//       };
//       img.src = e.target.result;
//     };
  
//     reader.readAsDataURL(file);
// }

// const getMouseClickPosition = (e) => {
//     // DUE TO THE CANVAS BEING SCALED BY CSS
//     // GETTING THE REAL SIZE IS REQUIRED BEFORE DETERMINING THE MOUSE CLICK
//     var rect = canvas.getBoundingClientRect();

//     let realWidth = rect.width;
//     let realHeight = rect.height;

//     // console.log(realWidth, realHeight)
//     // console.log(rect.left, rect.top)

//     let clickXWithoutScale = e.x - rect.left;
//     let clickYWithoutScale = e.y - rect.top;

//     let mouseX = Math.floor(clickXWithoutScale * (canvas.width / realWidth));
//     let mouseY = Math.floor(clickYWithoutScale * (canvas.height / realHeight));

//     return {mouseX, mouseY}
// }

// const addIndicator = (x, y, colorRGB) => {
//     let leftPercentage = x / canvas.width;
//     let topPercentage = y / canvas.height;

//     let newIndicatorElement = document.createElement("div");
//     newIndicatorElement.classList.add("indicator")
//     newIndicatorElement.setAttribute("style", `top: ${(topPercentage*100).toFixed(2)}%; left: ${(leftPercentage*100).toFixed(2)}%; background-color: rgb(${colorRGB[0]}, ${colorRGB[1]}, ${colorRGB[2]});`)

//     let colorHSL = rgbToHsl(...colorRGB);

//     let newColorSource = {
//         position: [x, y],
//         color: [colorHSL[0], colorHSL[1], colorHSL[2]],
//         threshold: {
//             hue: 0.1,  // DEFAULT VALUES
//             sat: 0.1,
//             bri: 0.1,
//             radius: 20,
//         }
//     }
//     colorSource.push(newColorSource);
//     console.log(colorSource)

//     indicatorHolderElement.appendChild(newIndicatorElement);
// }

// const toggleIndicatorDisplay = () => {
//     showVisualizer = !showVisualizer;

//     if (!showVisualizer) {
//         indicatorHolderElement.classList.add("hidden")
//     } else {
//         indicatorHolderElement.classList.remove("hidden")
//     }
// }


// const changeImageHolderDirection = () => {
//     var windowAspectRatio = window.innerWidth / window.innerHeight;

//     if (imageAspectRatio > windowAspectRatio) {
//         if (currentHolderDirection !== "horizontal") {
//             canvasHolder.setAttribute("data-image-direction", "horizontal");
//             currentHolderDirection = "horizontal";
//         }
//     } else {
//         if (currentHolderDirection !== "vertical") {
//             canvasHolder.setAttribute("data-image-direction", "vertical");
//             currentHolderDirection = "vertical";
//         }
//     }
// }

// // Once the image has loaded, draw it onto the canvas
// img.onload = function() {
//     // Get the size of the image
//     imageWidth = img.naturalWidth;
//     imageHeight = img.naturalHeight;
//     imageAspectRatio = imageWidth / imageHeight;

//     changeImageHolderDirection()
    
//     // Set the size of the canvas to match the image size
//     canvas.width = imageWidth;
//     canvas.height = imageHeight;

//     // // Draw the scaled-down image onto the canvas
//     ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
// };

// window.addEventListener("resize", () => {
//     changeImageHolderDirection()
// });


// // Add an event listener for mouse clicks on the canvas
// canvas.addEventListener("click", function(event) {
//     // GET REAL CLICK PIXEL
//     let {mouseX, mouseY} = getMouseClickPosition(event);

//     // Get the pixel color data at the clicked point
//     var pixelData = ctx.getImageData(mouseX, mouseY, 1, 1).data;

//     // Get the RGB color values from the pixel data
//     var red = pixelData[0];
//     var green = pixelData[1];
//     var blue = pixelData[2];

//     sampledColors[0] = [red, green, blue]
//     // ctx.putImageData(getUpdatedImageData(), 0, 0);

//     addIndicator(mouseX, mouseY, [red, green, blue]);

//     // document.querySelector(".clicked-color").setAttribute("style", `background-color: rgb(${red}, ${green}, ${blue});`)

//     // Display the color in the console
//     console.log(`Clicked color: rgb(${red}, ${green}, ${blue}) @ [${mouseX}, ${mouseY}]`);
// });