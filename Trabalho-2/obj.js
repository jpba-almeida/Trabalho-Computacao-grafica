import {
  groundVS,
  groundFS,
  skyVS,
  skyFS,
  ballFS,
  ballVS,
  obj_vs,
  obj_fs,
} from "./shaders.js";

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];

  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [objPositions, objTexcoords, objNormals, objColors];

  // same order as `f` indices
  let webglVertexData = [
    [], // positions
    [], // texcoords
    [], // normals
    [], // colors
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ["default"];
  let material = "default";
  let object = "default";

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [position, texcoord, normal, color];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split("/");
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

  const keywords = {
    v(parts) {
      // if there are more than 3 values here they are vertex colors
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop, // smoothing group
    mtllib(parts, unparsedArgs) {
      // the spec says there can be multiple filenames here
      // but many exist with spaces in a single filename
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
      Object.entries(geometry.data).filter(([, array]) => array.length > 0)
    );
  }

  return {
    geometries,
    materialLibs,
  };
}

function parseMapArgs(unparsedArgs) {
  // TODO: handle options
  return unparsedArgs;
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts) {
      material.shininess = parseFloat(parts[0]);
    },
    Ka(parts) {
      material.ambient = parts.map(parseFloat);
    },
    Kd(parts) {
      material.diffuse = parts.map(parseFloat);
    },
    Ks(parts) {
      material.specular = parts.map(parseFloat);
    },
    Ke(parts) {
      material.emissive = parts.map(parseFloat);
    },
    map_Kd(parts, unparsedArgs) {
      material.diffuseMap = parseMapArgs(unparsedArgs);
    },
    map_Ns(parts, unparsedArgs) {
      material.specularMap = parseMapArgs(unparsedArgs);
    },
    map_Bump(parts, unparsedArgs) {
      material.normalMap = parseMapArgs(unparsedArgs);
    },
    Ni(parts) {
      material.opticalDensity = parseFloat(parts[0]);
    },
    d(parts) {
      material.opacity = parseFloat(parts[0]);
    },
    illum(parts) {
      material.illum = parseInt(parts[0]);
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function create1PixelTexture(gl, pixel) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(pixel)
  );
  return texture;
}

function createTexture(gl, url) {
  const texture = create1PixelTexture(gl, [128, 192, 255, 255]);
  // Asynchronously load an image
  const image = new Image();
  image.src = url;
  image.addEventListener("load", function () {
    // Now that the image has loaded make copy it to the texture.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Check if the image is a power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn of mips and set wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  });
  return texture;
}

function makeIndexIterator(indices) {
  let ndx = 0;
  const fn = () => indices[ndx++];
  fn.reset = () => {
    ndx = 0;
  };
  fn.numElements = indices.length;
  return fn;
}

function makeUnindexedIterator(positions) {
  let ndx = 0;
  const fn = () => ndx++;
  fn.reset = () => {
    ndx = 0;
  };
  fn.numElements = positions.length / 3;
  return fn;
}

const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

function generateTangents(position, texcoord, indices) {
  const getNextIndex = indices
    ? makeIndexIterator(indices)
    : makeUnindexedIterator(position);
  const numFaceVerts = getNextIndex.numElements;
  const numFaces = numFaceVerts / 3;

  const tangents = [];
  for (let i = 0; i < numFaces; ++i) {
    const n1 = getNextIndex();
    const n2 = getNextIndex();
    const n3 = getNextIndex();

    const p1 = position.slice(n1 * 3, n1 * 3 + 3);
    const p2 = position.slice(n2 * 3, n2 * 3 + 3);
    const p3 = position.slice(n3 * 3, n3 * 3 + 3);

    const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
    const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
    const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);

    const dp12 = m4.subtractVectors(p2, p1);
    const dp13 = m4.subtractVectors(p3, p1);

    const duv12 = subtractVector2(uv2, uv1);
    const duv13 = subtractVector2(uv3, uv1);

    const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
    const tangent = Number.isFinite(f)
      ? m4.normalize(
          m4.scaleVector(
            m4.subtractVectors(
              m4.scaleVector(dp12, duv13[1]),
              m4.scaleVector(dp13, duv12[1])
            ),
            f
          )
        )
      : [1, 0, 0];

    tangents.push(...tangent, ...tangent, ...tangent);
  }

  return tangents;
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }
  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [obj_vs, obj_fs]);

  const objHref = "./assets/Hot_Air_Balloon/Hot_Air_Balloon.obj";

  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(
    obj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );
  const materials = parseMTL(matTexts.join("\n"));

  const textures = {
    defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]),
    defaultNormal: create1PixelTexture(gl, [127, 127, 255, 0]),
  };

  // load texture for materials
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith("Map"))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = createTexture(gl, textureHref);
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  // hack the materials so we can see the specular map
  Object.values(materials).forEach((m) => {
    m.shininess = 25;
    m.specular = [3, 2, 1];
  });

  const defaultMaterial = {
    diffuse: [0.5, 0.5, 0.5],
    diffuseMap: textures.defaultWhite,
    normalMap: textures.defaultNormal,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    specularMap: textures.defaultWhite,
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({ material, data }) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // generate tangents if we have the data to do so.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // There are no tangents
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // we probably want to generate normals if there are none
      data.normal = { value: [0, 0, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
    };
  });

  // Set zNear and zFar to something hopefully appropriate
  // for the size of this object.
  const zNear = 0.1;
  const zFar = 2000;

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  // Defina as posições iniciais dos balões
  const balloonPositions = [
    [17, 7, 107],
    [-103, 7, -83],
    [-193, 7, -393],
    [87, 7, -593],
    [207, 7, -133],
    [-73, 7, -493],
    [317, 7, 207],
    [-273, 7, -703],
    [407, 7, -333],
  ];

  var balloons = balloonPositions.map((position) => {
    return {
      position: position,
    };
  });

  const ballProgramInfo = twgl.createProgramInfo(gl, [ballVS, ballFS]);

  let controls = new (function () {
    this.t = 0;
    this.target = [0, 0, 0];
    this.ballsSpeed = 550;
    this.ballsRadius = 0.8;
  })();

  document.addEventListener("keydown", onKeyDown, false);

  let lastMouseX = -1,
    lastMouseY = -1;
  function onKeyDown(event) {
    if (event.keyCode == 32) {
      onSpaceKeyPressed(event);
    }
  }
  let t = 0;
  let balls = []; // Array para armazenar informações das bolas
  let target = [0, 0, 0];
  let cameraPosition = m4.normalize(
    m4.subtractVectors(target, calculatePoint(points, t))
  );

  function onSpaceKeyPressed(event) {
    launchBall(lastMouseX, lastMouseY);
  }

  function createBall(position, velocity) {
    const ball = primitives.createSphereWithVertexColorsBufferInfo(
      gl,
      10,
      24, // aumentar divisões de longitude
      12 // aumentar divisões de latitude
    );
    const ballWorldMatrix = m4.translation(
      position[0],
      position[1],
      position[2]
    );
    const color = [0.5, 0.5, 0.5];
    const ballData = {
      ballInfo: ball,
      worldMatrix: ballWorldMatrix,
      velocity: velocity,
      color: color,
      lightColor: color, // Defina a nova cor da luz da bola com intensidade aumentada
    };
    balls.push(ballData);
    return ballData;
  }

  function launchBall() {
    if (animationRunning || event.keyCode == true) {
      const currentTime = Date.now();
      t = (currentTime % animationDuration) / animationDuration;

      cameraPosition = calculatePoint(points, t);
      const startPosition = cameraPosition;

      // Calcular a direção com base na direção para a frente da câmera
      const cameraDirection = [view[8], view[9], view[10]];
      const velocity = m4.normalize(cameraDirection);

      // console.log(cameraPosition, cameraDirection);

      createBall(startPosition, velocity);
    }
  }

  let ballsLastTime = 0;

  function updateBalls(time) {
    const deltaTime = time - ballsLastTime;
    ballsLastTime = time;

    const cameraDirection = [view[8], view[9], view[10]];

    for (let i = balls.length - 1; i >= 0; i--) {
      const ballData = balls[i];

      if (ballData.worldMatrix[13] === -100) continue;

      // Definir velocidade inicial igual a direção da câmera
      ballData.velocity = m4.normalize(ballData.velocity);

      // Calcular deslocamento mantendo a mesma direção
      const displacement = m4.scaleVector(
        cameraDirection,
        controls.ballsSpeed * (deltaTime * 0.001)
      );
      //console.log(cameraDirection);
      // Atualizar posição da bola
      ballData.lightColor = ballData.color;
      ballData.worldMatrix = m4.translate(
        ballData.worldMatrix,
        displacement[0] + 15,
        displacement[1] + 5,
        displacement[2]
      );
    }
  }

  function drawBalls(sharedUniforms) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const ballData = balls[i];
      gl.useProgram(ballProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, ballProgramInfo, ballData.ballInfo);
      twgl.setUniforms(ballProgramInfo, {
        u_world: ballData.worldMatrix,
        u_color: ballData.color,
        u_lightColor: ballData.lightColor,
      });

      twgl.setUniforms(ballProgramInfo, sharedUniforms);
      twgl.drawBufferInfo(gl, ballData.ballInfo);
    }
  }

  function checkCollisions() {
    for (let i = balls.length - 1; i >= 0; i--) {
      const ballPosition = [
        balls[i].worldMatrix[12],
        balls[i].worldMatrix[13],
        balls[i].worldMatrix[14],
      ];
      const ballRadius = 0.5;

      for (let j = balloons.length - 1; j >= 0; j--) {
        const balloon = balloons[j];
        const balloonPosition = balloon.position;
        const balloonRadius = 75;

        // Calcule a distância entre o centro da bola e o centro do balão
        const dx = ballPosition[0] - balloonPosition[0];
        const dy = ballPosition[1] - balloonPosition[1];
        const dz = ballPosition[2] - balloonPosition[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Verifique se ocorreu uma colisão
        if (distance < ballRadius + balloonRadius) {
          // O balão colidiu com a bola
          console.log("Colisão detectada entre balão e bola");

          balloons.splice(j, 1); // Remove o balão da matriz balloons
          balls.splice(i, 1); // Remove a bola da matriz balls
        }
      }
    }
  }
  function balloonsAcount(length) {
    const balloonsAcount = document.getElementById("balloonsAcount");
    balloonsAcount.textContent = length;
  }

  function render(time) {
    time *= 0.001; // converter para segundos

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    const sharedUniforms = {
      u_projection: projection,
    };
    const movements = [
      { x: 10 + 15, y: -30 * Math.cos(time) + 15, z: 100 + 15 },
      { x: -110 + 15, y: 0 + 15, z: -90 * Math.cos(time) + 15 },
      { x: -200 * Math.cos(time) + 15, y: 50 + 15, z: -400 + 15 },
      { x: 80 * Math.cos(time * 0.5) + 15, y: -70 + 15, z: -600 + 15 },
      {
        x: 200 * Math.cos((time / 2) * 0.5) + 15,
        y: 50 + 15,
        z: -140 * Math.cos(time) * Math.cos(time * 0.5) + 15,
      },
      {
        x: -80 * Math.cos(time * 0.5) + 15,
        y: -50 + 15,
        z: -500 * Math.sin(time / 2) + 15,
      },
      { x: 300 + 15, y: -40 * Math.cos(time) + 15, z: 150 + 15 },
      { x: 120 + 15, y: 20 + 15, z: -125 * Math.cos(time) + 15 },
      { x: 160 * Math.cos(time * 0.5) + 15, y: -80 + 15, z: -800 + 15 },
    ];

    for (let i = 0; i < balloons.length; i++) {
      const balloon = balloons[i];
      const movement = movements[i];

      // Atualizar a posição com base na velocidade
      balloon.position = [movement.x, movement.y, movement.z];
      balloonPositions[i] = [movement.x, movement.y, movement.z];

      const position = balloonPositions[i];

      const world = m4.identity();
      world[12] = position[0];
      world[13] = position[1];
      world[14] = position[2];

      const scaledUWorld = m4.scale(world, 0.2, 0.2, 0.2);

      gl.useProgram(meshProgramInfo.program);
      webglUtils.setUniforms(meshProgramInfo, {
        u_world: scaledUWorld,
        u_view: view,
        u_viewWorldPosition: cameraPosition,
      });

      for (const { bufferInfo, material } of parts) {
        webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
        webglUtils.setUniforms(meshProgramInfo, sharedUniforms, material);
        webglUtils.drawBufferInfo(gl, bufferInfo);
      }

      checkCollisions();
    }

    let ballsPositions = [];
    let ballsColors = [];
    const cameraDirection = [view[8], view[9], view[10]];

    const sharedUniformsball = {
      u_ballsPositions: ballsPositions,
      u_ballsColors: ballsColors,
      u_ambientLightIntensity: 50,
      u_ambientLightColor: [1, 1, 1],
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraDirection,
      u_displacementScale: 10000,
      u_specular: 0.1,
      u_lightPosition: [-10, 10, 0],
      u_viewPosition: cameraPosition,
      u_ambientColor: [0.2, 0.2, 0.2],
      u_diffuseColor: [0.5, 0.5, 0.5],
      u_specularColor: [1, 1, 1],
      u_specularShininess: 50,
    };

    updateBalls(time);
    drawBalls(sharedUniformsball);
    balloonsAcount(balloons.length);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
main();
