"use strict";

const ballVS = `

attribute vec4 a_position; // Posição do vértice
attribute vec3 a_normal;   // Normal do vértice
attribute vec2 a_texcoord; // Coordenada de textura, se aplicável

uniform mat4 u_world;     // Matriz de transformação do mundo
uniform mat4 u_view;      // Matriz de visualização
uniform mat4 u_projection; // Matriz de projeção

varying vec3 v_normal;    // Normal do vértice para o fragment shader
varying vec2 v_texcoord;  // Coordenada de textura para o fragment shader

void main() {
    // Transformações de vértice
    vec4 worldPosition = u_world * a_position;
    vec4 viewPosition = u_view * worldPosition;
    gl_Position = u_projection * viewPosition;

    // Passe a normal e coordenada de textura para o fragment shader
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
}

`;

const ballFS = `
precision mediump float;

varying vec3 v_normal;   // Normal do vértice do shader do vértice
varying vec2 v_texcoord; // Coordenada de textura do shader do vértice

uniform vec3 u_lightPosition;  // Posição da luz
uniform vec3 u_ambientColor;   // Cor ambiente
uniform vec3 u_diffuseColor;   // Cor difusa
uniform vec3 u_specularColor;  // Cor especular
uniform float u_specularShininess; // Exponente de brilho (shininess)

void main() {
    // Cálculos de iluminação
    vec3 lightDirection = normalize(u_lightPosition - gl_FragCoord.xyz);
    vec3 normal = normalize(v_normal);
    float diffuse = max(dot(normal, lightDirection), 0.0);
    
    // Cálculo da reflexão especular
    vec3 viewDirection = normalize(-gl_FragCoord.xyz);
    vec3 reflectDirection = reflect(-lightDirection, normal);
    float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), u_specularShininess);
    
    // Combinação de cores ambiente, difusa e especular
    vec3 ambient = u_ambientColor;
    vec3 diffuseColor = u_diffuseColor * diffuse;
    vec3 specularColor = u_specularColor * specular;
    
    // Cor final
    vec3 finalColor = ambient + diffuseColor + specularColor;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const groundVS = `
attribute vec4 position;
attribute vec3 normal;
attribute vec2 texcoord;

uniform mat4 projection;
uniform mat4 modelView;

varying vec3 v_normal;
varying vec2 v_texcoord;
varying vec3 v_fragPos;

void main() {
    gl_Position = projection * modelView * position;
    v_normal = mat3(modelView) * normal;
    v_texcoord = texcoord;

    v_fragPos = vec3(modelView * position);
}
`;

const groundFS = `
precision highp float;

varying vec2 v_texcoord;
varying vec3 v_normal;
varying vec3 v_fragPos;

uniform sampler2D displacementMap;
uniform sampler2D texture;
uniform vec3 u_lightPosition;

void main() {
    vec4 texColor = texture2D(texture, v_texcoord);
    float displacementScale = 10.0;
    float groundTexture = texture2D(texture, v_texcoord).r;
    vec3 normal = normalize(v_normal);

    vec3 lightDir = normalize(u_lightPosition - v_fragPos);
    float light = dot(lightDir, normal) * 0.7 + 0.4;

    vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.5, 0.7, 1.0), groundTexture);

    gl_FragColor = vec4(color, 1 * 2) * texColor;
    gl_FragColor.rgb -= light * 2.0;
}
`;

const skyVS = `
attribute vec4 a_position;
varying vec4 v_position;

void main() {
    v_position = a_position;
    gl_Position = a_position;
    gl_Position.z = 1.0;
}
`;

const skyFS = `
precision mediump float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;
varying vec4 v_position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_position;
    gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}
`;

const obj_vs = `
  attribute vec4 a_position;
  attribute vec3 a_normal;
  attribute vec3 a_tangent;
  attribute vec2 a_texcoord;
  attribute vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  varying vec3 v_normal;
  varying vec3 v_tangent;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

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

const obj_fs = `
  precision highp float;

  varying vec3 v_normal;
  varying vec3 v_tangent;
  varying vec3 v_surfaceToView;
  varying vec2 v_texcoord;
  varying vec4 v_color;

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

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture2D(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.5, 1.0);
    vec4 specularMapColor = texture2D(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    gl_FragColor = vec4(
        emissive / 2.0 +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess / 1.0),
        effectiveOpacity);
  }
  `;

export { groundVS, groundFS, skyVS, skyFS, ballFS, ballVS, obj_vs, obj_fs };
