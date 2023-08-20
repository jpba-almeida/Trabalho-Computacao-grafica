"use strict";

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
    mtllib(parts) {
      // the spec says there can be multiple file here
      // but I found one with a space in the filename
      // materialLibs.push(parts.join(' '));
      materialLibs.push(parts.join(" "));
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
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position etc..
  twgl.setAttributePrefix("a_");

  const vs = `#version 300 es
  in vec4 a_position;
  in vec3 a_normal;
  in vec3 a_tangent;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  out vec3 v_normal;
  out vec3 v_tangent;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

    mat3 normalMat = mat3(u_world);
    v_normal = normalize(normalMat * a_normal);
    v_tangent = normalize(normalMat * a_tangent);

    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_tangent;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform sampler2D normalMap;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    outColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;

  var sliderPositions = {
    R: 0,
    T: 0,
  };

  // Pontos de controle para splines bezier de grau 3
  const points = {
    P0: [30, 0, 22],
    P1: [-25, -10, 22],
    P2: [-30, -10, 22],

    P3: [-110, -4, 2],
    P4: [-30, -10, 22],
    P5: [-130, -10, 22],

    P6: [-10, -5, -15],
    P7: [-37, -5, 22],
    P8: [-130, -0, 22],

    P9: [-10, -13, 32],
    P10: [-10, -5, 18],
    P11: [-20, -15, 39],
    P12: [-30, -10, 22],
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

  // Sliders
  webglLessonsUI.setupSlider("#cameraSlider", {
    min: 0,
    max: 0.999,
    step: 0.001,
    precision: 3,
  });

  sliderPositions.R = document.querySelector(
    "#cameraSlider .gman-widget-value"
  ).textContent;

  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  async function loadOBJWithMaterials(objHref) {
    // Fazer a requisição do arquivo OBJ e obter o texto
    const response = await fetch(objHref);
    const text = await response.text();

    // Fazer o parsing do arquivo OBJ
    const obj = parseOBJ(text);

    // Criar uma URL base para os arquivos de materiais usando o local atual
    const baseHref = new URL(objHref, window.location.href);

    // Fazer a requisição dos arquivos de materiais
    const matTexts = await Promise.all(
      obj.materialLibs.map(async (filename) => {
        // Construir a URL completa do arquivo de material
        const matHref = new URL(filename, baseHref).href;

        // Fazer a requisição do arquivo de material e obter o texto
        const matResponse = await fetch(matHref);
        return await matResponse.text();
      })
    );

    // Fazer o parsing dos materiais
    const materials = parseMTL(matTexts.join("\n"));

    // Retornar o objeto e os materiais carregados, juntamente com a baseHref
    return {
      obj,
      materials,
      baseHref, // Adicionado baseHref ao objeto de retorno
    };
  }

  const objects = [];

  const sirusCity = await loadOBJWithMaterials(
    "./Sirus5 Colonial City/sirus city.obj"
  );
  objects.push(sirusCity);
  const castle = await loadOBJWithMaterials("./castle/castle.obj");
  objects.push(castle);

  const segundoObjHref = "./Hot_Air_Balloon/Hot_Air_Balloon.obj";
  const segundoObjResponse = await fetch(segundoObjHref);
  const segundoObjText = await segundoObjResponse.text();
  const segundoObj = parseOBJ(segundoObjText);
  const segundoBaseHref = new URL(segundoObjHref, window.location.href);
  const segundoMatTexts = await Promise.all(
    segundoObj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, segundoBaseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );

  const segundoMaterials = parseMTL(segundoMatTexts.join("\n"));

  const terceiroObjHref = "./Hot_Air_Balloon/Hot_Air_Balloon.obj";
  const terceiroObjResponse = await fetch(terceiroObjHref);
  const terceiroObjText = await terceiroObjResponse.text();
  const terceiroObj = parseOBJ(terceiroObjText);
  const terceiroBaseHref = new URL(terceiroObjHref, window.location.href);
  const terceiroMatTexts = await Promise.all(
    terceiroObj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, terceiroBaseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );

  const terceiroMaterials = parseMTL(terceiroMatTexts.join("\n"));

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i].obj;
    const materials = objects[i].materials;
    const baseHref = objects[i].baseHref;

    const textures = {
      defaultWhite: twgl.createTexture(gl, { src: [255, 255, 255, 255] }),
      defaultNormal: twgl.createTexture(gl, { src: [127, 127, 255, 0] }),
    };

    // load texture for materials
    for (const material of Object.values(materials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith("Map"))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, baseHref).href;
            texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }

    for (const material of Object.values(segundoMaterials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith("Map"))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, segundoBaseHref).href;
            texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }

    for (const material of Object.values(terceiroMaterials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith("Map"))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, terceiroBaseHref).href;
            texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }

    // hack the materials so we can see the specular map
    Object.values(materials).forEach((m) => {
      m.shininess = 500;
      m.specular = [3, 2, 1];
    });

    const defaultMaterial = {
      diffuse: [1, 1, 1],
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
      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
      const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
      return {
        material: {
          ...defaultMaterial,
          ...materials[material],
        },
        bufferInfo,
        vao,
      };
    });

    const segundoParts = segundoObj.geometries.map(({ material, data }) => {
      if (data.color) {
        if (data.position.length === data.color.length) {
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        data.color = { value: [1, 1, 1, 1] };
      }

      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        data.tangent = { value: [1, 0, 0] };
      }

      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }

      if (!data.normal) {
        data.normal = { value: [0, 0, 1] };
      }

      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
      const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
      return {
        material: {
          ...defaultMaterial,
          ...segundoMaterials[material],
        },
        bufferInfo,
        vao,
      };
    });

    const terceiroParts = terceiroObj.geometries.map(({ material, data }) => {
      if (data.color) {
        if (data.position.length === data.color.length) {
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        data.color = { value: [1, 1, 1, 1] };
      }

      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        data.tangent = { value: [1, 0, 0] };
      }

      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }

      if (!data.normal) {
        data.normal = { value: [0, 0, 1] };
      }

      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
      const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
      return {
        material: {
          ...defaultMaterial,
          ...terceiroMaterials[material],
        },
        bufferInfo,
        vao,
      };
    });

    function getExtents(positions) {
      const min = positions.slice(0, 3);
      const max = positions.slice(0, 3);
      for (let i = 3; i < positions.length; i += 3) {
        for (let j = 0; j < 3; ++j) {
          const v = positions[i + j];
          min[j] = Math.min(v, min[j]);
          max[j] = Math.max(v, max[j]);
        }
      }
      return { min, max };
    }

    function getGeometriesExtents(geometries) {
      return geometries.reduce(
        ({ min, max }, { data }) => {
          const minMax = getExtents(data.position);
          return {
            min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
            max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
          };
        },
        {
          min: Array(3).fill(Number.POSITIVE_INFINITY),
          max: Array(3).fill(Number.NEGATIVE_INFINITY),
        }
      );
    }

    const extents = getGeometriesExtents(obj.geometries);
    const range = m4.subtractVectors(extents.max, extents.min);
    // amount to move the object so its center is at the origin
    const objOffset = m4.scaleVector(
      m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
      -1
    );

    const zNear = 0.1;
    const zFar = 500;

    function degToRad(deg) {
      return (deg * Math.PI) / 180;
    }

    const animateButton = document.getElementById("animateButton");
    animateButton.addEventListener("click", startCameraAnimation);

    async function startCameraAnimation() {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const animationDurationPerSegment = 20;
      const up = [0, 1, 0];
      const fieldOfViewRadians = degToRad(60);
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const projection = m4.perspective(
        fieldOfViewRadians,
        aspect,
        zNear,
        zFar
      );
      const cameraSlider = document.getElementById("cameraSlider");
      cameraSlider.disabled = true;

      function animateSegment(segmentIndex, startTime) {
        const currentTime = performance.now() / 1000;
        const elapsedSeconds = currentTime - startTime;
        const t = Math.min(elapsedSeconds / animationDurationPerSegment, 1);

        const cameraPosition = calculatePoint(points, t);
        const cameraTarget = Tangente(points, t);

        const sliderValue = t * animationDurationPerSegment;
        document.querySelector("#cameraSlider .gman-widget-value").textContent =
          sliderValue.toFixed(1);

        const camera = m4.lookAt(cameraPosition, cameraTarget, up);
        const view = m4.inverse(camera);
        let u_world = m4.yRotation(0);
        u_world = m4.translate(u_world, ...objOffset);
        const sharedUniforms = {
          u_lightDirection: m4.normalize([-1, 3, 5]),
          u_view: view,
          u_projection: projection,
          u_viewWorldPosition: cameraPosition,
        };
        twgl.setUniforms(meshProgramInfo, sharedUniforms);
        for (const { bufferInfo, vao, material } of parts) {
          gl.bindVertexArray(vao);
          twgl.setUniforms(
            meshProgramInfo,
            {
              u_world,
            },
            material
          );
          twgl.drawBufferInfo(gl, bufferInfo);
        }

        if (t < 1) {
          requestAnimationFrame(() => animateSegment(segmentIndex, startTime));
        } else if (segmentIndex < Object.keys(points).length - 4) {
          animateSegment(segmentIndex + 1, currentTime);
        } else {
          cameraSlider.disabled = false;
        }
      }
      animateSegment(0, performance.now() / 1000);
    }

    let segundoObjectTime = 0;
    let terceiroObjectTime = 1;

    function render(time) {
      time *= 0.001; // convert to segundos

      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.DEPTH_TEST);

      const fieldOfViewRadians = degToRad(60);
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const projection = m4.perspective(
        fieldOfViewRadians,
        aspect,
        zNear,
        zFar
      );

      // Get slider values
      sliderPositions.R = document.querySelector(
        "#cameraSlider .gman-widget-value"
      ).textContent;

      // Calculate camera position and target
      const cameraTarget = Tangente(points, sliderPositions.R);
      const cameraPosition = calculatePoint(points, sliderPositions.R);
      const up = [0, 1, 0];

      // Compute the camera's matrix using look at.
      const camera = m4.lookAt(cameraPosition, cameraTarget, up);

      // Make a view matrix from the camera matrix.
      const view = m4.inverse(camera);

      // Shared uniforms for shaders
      const sharedUniforms = {
        u_lightDirection: m4.normalize([-1, 3, 5]),
        u_view: view,
        u_projection: projection,
        u_viewWorldPosition: cameraPosition,
      };

      gl.useProgram(meshProgramInfo.program);

      // Calls gl.uniform
      twgl.setUniforms(meshProgramInfo, sharedUniforms);

      // Compute the world matrix once since all parts are at the same space.
      let u_world = m4.yRotation(0);
      u_world = m4.translate(u_world, ...objOffset);

      // Render main object parts
      for (let i = 0; i < parts.length; i++) {
        const { bufferInfo, vao, material } = parts[i];
        gl.bindVertexArray(vao);
        twgl.setUniforms(
          meshProgramInfo,
          {
            u_world,
          },
          material
        );
        twgl.drawBufferInfo(gl, bufferInfo);
      }

      // Update time for the segundo object animation
      segundoObjectTime += 0.01;

      // Render segundo object parts
      for (const { bufferInfo, vao, material } of segundoParts) {
        const scaledUWorld = m4.scale(u_world, 0.2, 0.2, 0.2);
        const xOffset = Math.sin(segundoObjectTime) * 850;
        const initialX = 530;
        const initialY = 100;
        const translatedUWorld = m4.translate(
          scaledUWorld,
          initialX,
          initialY,
          xOffset
        );
        gl.bindVertexArray(vao);
        twgl.setUniforms(
          meshProgramInfo,
          {
            u_world: translatedUWorld,
          },
          material
        );
        twgl.drawBufferInfo(gl, bufferInfo);
      }

      // Update time for the terceiro object animation
      terceiroObjectTime += 0.01;

      // Render terceiro object parts
      for (const { bufferInfo, vao, material } of terceiroParts) {
        const scaledUWorld = m4.scale(u_world, 0.1, 0.1, 0.1);
        const xOffset = Math.sin(terceiroObjectTime) * 850;
        const initialX = -53;
        const initialY = 150;
        const translatedUWorld = m4.translate(
          scaledUWorld,
          initialX,
          initialY + xOffset,
          xOffset
        );
        gl.bindVertexArray(vao);
        twgl.setUniforms(
          meshProgramInfo,
          {
            u_world: translatedUWorld,
          },
          material
        );
        twgl.drawBufferInfo(gl, bufferInfo);
      }

      // Request the next frame
      requestAnimationFrame(render);
    }

    // Call the initial frame
    requestAnimationFrame(render);
  }
}

main();
