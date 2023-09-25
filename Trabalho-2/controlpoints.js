var points = {
  P0: [-8.39, -1.3, 14.41],
  P1: [-13.68, -1.3, 31.6],

  P2: [-3.49, -1.3, 26.51],

  P3: [6.75, -1.3, 27.27],

  P4: [15.99, -6.3, 27.93],

  P5: [28.06, -6.3, 28.03],

  P6: [25.48, -6.3, 10.45],

  P7: [22.51, -6.3, -11.47],

  P8: [8.73, -6.3, -51.08],

  P9: [-7.26, -3.3, -39.28],

  P10: [-21.25, -6.3, -22.87],

  P11: [-2.16, -6.3, -1.47],

  P12: [-8.39, -1.3, 14.41],
};

// Função para interpolar coordenadas
function interpolateCoordinate(coord, targetCoord, t) {
  // Interpolate a single coordinate using the formula: coord + t * (targetCoord - coord)
  return coord + t * (targetCoord - coord);
}

function calculatePoint(points, t) {
  const segmentIndex = Math.floor(t * 4); // Determine which segment t falls into
  const segmentT = t * 4 - segmentIndex; // Rescale t within the segment

  const startIndex = segmentIndex * 3; // Index of the starting point for the current segment
  const X = points[`P${startIndex}`];
  const Y = points[`P${startIndex + 1}`];
  const Z = points[`P${startIndex + 2}`];
  const W = points[`P${startIndex + 3}`];

  // Interpolate coordinates for each point in the segment
  const A = X.map((coord, index) =>
    interpolateCoordinate(coord, Y[index], segmentT)
  );
  const B = Y.map((coord, index) =>
    interpolateCoordinate(coord, Z[index], segmentT)
  );
  const C = Z.map((coord, index) =>
    interpolateCoordinate(coord, W[index], segmentT)
  );

  const D = A.map((coord, index) =>
    interpolateCoordinate(coord, B[index], segmentT)
  );
  const BC = B.map((coord, index) =>
    interpolateCoordinate(coord, C[index], segmentT)
  );

  const ABC = D.map((coord, index) =>
    interpolateCoordinate(coord, BC[index], segmentT)
  );

  // Multiply each coordinate by 10 and return
  return ABC.map((element) => 10 * element);
}

function Tangente(points, t) {
  const segmentIndex = Math.floor(t * 4);
  const segmentT = t * 4 - segmentIndex;

  const startIndex = segmentIndex * 3;
  const X = points[`P${startIndex}`];
  const Y = points[`P${startIndex + 1}`];
  const Z = points[`P${startIndex + 2}`];
  const W = points[`P${startIndex + 3}`];

  const A = X.map((coord, index) =>
    interpolateCoordinate(coord, Y[index], segmentT)
  );
  const B = Y.map((coord, index) =>
    interpolateCoordinate(coord, Z[index], segmentT)
  );
  const C = Z.map((coord, index) =>
    interpolateCoordinate(coord, W[index], segmentT)
  );
  const ABC = B.map((coord, index) =>
    interpolateCoordinate(coord, C[index], segmentT)
  );

  return ABC.map((element) => 10 * element);
}
