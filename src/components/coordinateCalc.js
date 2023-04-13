export const xyToArrayIndex = (x, y, width) => {
    return x + (y * width);
}

export const indexToXY = (index, width) => {
    let x = index % width;
    let y = Math.floor(index / width);

    return {x, y}
}

export const powerOfDistance = (p1X, p1Y, p2X, p2Y) => {
    let xDiff = p1X - p2X;
    let yDiff = p1Y - p2Y;

    return xDiff * xDiff + yDiff * yDiff;
}

export const inRange = (p1X, p1Y, p2X, p2Y, distanceThreshold) => {
    return powerOfDistance(p1X, p1Y, p2X, p2Y) < distanceThreshold * distanceThreshold;
}

export const lerp = (start, end, amount) => {
    return (1 - amount) * start + amount * end
  }