function degToRad(d) {
  return (d * Math.PI) / 180;
}

var canvas = document.getElementById("canvas");

var cameraRotation = [0, 0]; // Initialize camera rotation angles

canvas.addEventListener("mouseover", function (event) {
  isMouseOverCanvas = true;
  previousMouseX = event.clientX;
  previousMouseY = event.clientY;
});

var canvasRect = canvas.getBoundingClientRect(); // Retornar o retângulo que descreve a posição do canvas na janela

canvas.addEventListener("mousemove", function (event) {
  if (isMouseOverCanvas) {
    var x = event.clientX - canvasRect.left; // Coordenada X relativa ao canvas
    var y = event.clientY - canvasRect.top; // Coordenada Y relativa ao canvas

    // Verifique se o cursor está dentro dos limites do canvas
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      var deltaX = x - previousMouseX;
      var deltaY = y - previousMouseY;

      previousMouseX = x;
      previousMouseY = y;

      // Update camera rotation based on mouse movement
      cameraRotation[0] -= degToRad(deltaY * 0.5); // Pitch
      cameraRotation[1] -= degToRad(deltaX * 0.5); // Yaw

      // Limit pitch to avoid camera flipping
      cameraRotation[0] = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, cameraRotation[0])
      );

      var distance = 100000;
      target[0] =
        cameraPosition[0] +
        Math.sin(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
      target[1] = cameraPosition[1] + Math.sin(cameraRotation[0]) * distance;
      target[2] =
        cameraPosition[2] +
        Math.cos(cameraRotation[1]) * Math.cos(cameraRotation[0]) * distance;
    }
  }
});

canvas.addEventListener("mouseup", MouseRelease, false);
canvas.addEventListener("mouseleave", MouseRelease, false);

function MouseRelease(event) {
  isMouseDragging = false;
}

var fov = degToRad(60);
var cameraPosition = [-100, 100, 100];
var target = [0, 0, 0];
var up = [0, 1, 0];
var camera = m4.lookAt(cameraPosition, target, up);
var view = m4.inverse(camera);
var animationDuration = 20000; // Animation duration in milliseconds
var cameraSpeed = 0.00005; // Speed at which the camera moves along the Z-axis

var startButton = document.getElementById("startAnimation");
var stopButton = document.getElementById("stopAnimation");
var animationRunning = false;
var requestId;

startButton.addEventListener("click", function () {
  if (!animationRunning) {
    animationRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    animateCamera();
  }
});

stopButton.addEventListener("click", function () {
  if (animationRunning) {
    animationRunning = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    cancelAnimationFrame(requestId); // Pára a animação
  }
});

function animateCamera() {
  if (animationRunning) {
    var currentTime = Date.now();
    t = (currentTime % animationDuration) / animationDuration;

    cameraPosition = calculatePoint(points, t);
    //target = Tangente(points, t + 0.01);
    camera = m4.lookAt(cameraPosition, target, up);
    view = m4.inverse(camera);
    requestId = requestAnimationFrame(animateCamera);

    if (t >= 1.0) {
      // A animação atingiu o fim, então pare a animação automaticamente
      animationRunning = false;
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }
}

// Inicialize os botões
startButton.disabled = false;
stopButton.disabled = true;

animateCamera();
