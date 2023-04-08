// Get the canvas element and context
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d", {willReadFrequently : true});

var showMatte = false;

// Create a new image object
var img = new Image();

// Set the source of the image
img.src = "./img.jpg";

var sampledColors = [[212, 188, 138]];

// Function to convert RGB to HSL (FROM 0 - 255)
const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

// Function to convert HSL to RGB (FROM 0 - 1)
const hslToRgb = (h, s, l) => {
    var r, g, b;
  
    if (s == 0) {
      r = g = b = l; // achromatic
    } else {
      var hue2rgb = function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
  
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
  
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
  
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const toggleMatte = () => {
    showMatte = !showMatte;
}

const shiftHue = (h, s, l) => {
    return [1, 1, 1]
    return [1-h, s, l]
}

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

const drawCircleOnCanvas = (x, y, radius = 20) => {
    ctx.fillStyle = "red";
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
}

const downloadCanvasAsJPEG = () => {
    // Convert the canvas to a base64-encoded JPEG image
    var dataURL = canvas.toDataURL("image/jpeg");

    // Create a download link for the image file
    var downloadLink = document.createElement("a");
    downloadLink.href = dataURL;
    downloadLink.download = "myImage.jpg"; // Set the filename of the downloaded file
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

const getMouseClickPosition = (e) => {
    // DUE TO THE CANVAS BEING SCALED BY CSS
    // GETTING THE REAL SIZE IS REQUIRED BEFORE DETERMINING THE MOUSE CLICK
    let realWidth = canvas.getBoundingClientRect().width;
    let realHeight = canvas.getBoundingClientRect().height;

    let clickXWithoutScale = e.x - canvas.offsetLeft;
    let clickYWithoutScale = e.y - canvas.offsetTop;

    let mouseX = Math.floor(clickXWithoutScale * (canvas.width / realWidth));
    let mouseY = Math.floor(clickYWithoutScale * (canvas.height / realHeight));

    return {mouseX, mouseY}

}

// Once the image has loaded, draw it onto the canvas
img.onload = function() {
    // Get the size of the image
    var width = img.naturalWidth;
    var height = img.naturalHeight;

    // Set the size of the canvas to match the image size
    canvas.width = width;
    canvas.height = height;

    // // Draw the scaled-down image onto the canvas
    ctx.drawImage(img, 0, 0, width, height);
};

// Add an event listener for mouse clicks on the canvas
canvas.addEventListener("click", function(event) {
    // GET REAL CLICK PIXEL
    let {mouseX, mouseY} = getMouseClickPosition(event);

    // Get the pixel color data at the clicked point
    var pixelData = ctx.getImageData(mouseX, mouseY, 1, 1).data;

    // Get the RGB color values from the pixel data
    var red = pixelData[0];
    var green = pixelData[1];
    var blue = pixelData[2];

    sampledColors[0] = [red, green, blue]
    ctx.putImageData(getUpdatedImageData(), 0, 0);

    // drawCircleOnCanvas(mouseX, mouseY)

    document.querySelector(".clicked-color").setAttribute("style", `background-color: rgb(${red}, ${green}, ${blue});`)

    // Display the color in the console
    console.log("Clicked color: rgb(" + red + ", " + green + ", " + blue + ")");
});