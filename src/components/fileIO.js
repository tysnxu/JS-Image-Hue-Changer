
export const downloadCanvasAsJPEG = (canvas) => {
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