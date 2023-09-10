# Trabalho Computação grafica

## OBJ Model Viewer Readme

This project is a WebGL-based OBJ model viewer that loads and displays 3D models from OBJ files along with their corresponding MTL material files. The viewer allows you to control the camera's position along a path created using cubic bezier splines, giving you a dynamic view of the loaded models.

## Features

- Load and display 3D models from OBJ files.
- Apply MTL materials to the models, including textures and lighting.
- Dynamic camera animation along a predefined cubic bezier spline path.
- Adjustable camera position using a slider.
- WebGL-based rendering for efficient and interactive model visualization.

## Getting Started

1. Clone this repository to your local machine.
2. Open the `index.html` file in a modern web browser with WebGL2 support.
3. Use the camera slider to navigate the camera along the predefined path.
4. Click the "Animate" button to start the camera animation.

## Usage

1. **Camera Navigation**: Use the camera slider to move the camera along the cubic bezier spline path. The slider value represents the position on the spline, ranging from 0 to 1.

2. **Animation**: Click the "Animate" button to start the camera animation. The camera will smoothly move along the predefined spline path. You can interrupt the animation by interacting with the camera slider.

## Libraries Used

- [twgl.js](https://twgljs.org/): A helper library for WebGL to simplify common WebGL tasks.
- [Bezier Curves](https://pomax.github.io/bezierinfo/): Concepts and mathematics behind cubic bezier curves.
- [Wavefront OBJ](http://paulbourke.net/dataformats/obj/): OBJ file format specification for 3D geometry representation.
- [MTL (Material Template Library)](http://paulbourke.net/dataformats/mtl/): MTL file format specification for material definitions.
