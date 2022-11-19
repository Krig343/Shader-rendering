"use strict"

//--------------------------------------------------------------------------------------------------------
// VERTEX SHADER
//--------------------------------------------------------------------------------------------------------
var terrain_vert =
    `#version 300 es

// INPUT
layout(location = 1) in vec2 position_in;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform sampler2D uSamplerTerrain;

// OUTPUT
out vec2 v_texCoord;
out vec3 v_position;
out vec3 v_normal;

// MAIN PROGRAM
void main()
{
	vec3 position = vec3(2.0 * position_in - 1.0, 0.0);
	float terrainHeight = texture(uSamplerTerrain, position_in).r;
	position.z += terrainHeight;

	float step = 1./100.;
	vec2 voisinA = position_in + vec2(step, 0.);
	vec2 voisinB = position_in + vec2(0., step);
	vec2 voisinC = position_in + vec2(-step, 0.);
	vec2 voisinD = position_in + vec2(0., -step);

	terrainHeight = texture(uSamplerTerrain, voisinA).r;
	vec3 pos_voisinA = vec3(2.0 * voisinA - 1.0, 0.0);
	pos_voisinA.z += terrainHeight;
	terrainHeight = texture(uSamplerTerrain, voisinB).r;
	vec3 pos_voisinB = vec3(2.0 * voisinB - 1.0, 0.0);
	pos_voisinB.z += terrainHeight;
	terrainHeight = texture(uSamplerTerrain, voisinC).r;
	vec3 pos_voisinC = vec3(2.0 * voisinC - 1.0, 0.0);
	pos_voisinC.z += terrainHeight;
	terrainHeight = texture(uSamplerTerrain, voisinD).r;
	vec3 pos_voisinD = vec3(2.0 * voisinD - 1.0, 0.0);
	pos_voisinD.z += terrainHeight;

	vec3 normal1 = normalize(cross(pos_voisinA - position, pos_voisinB - position));
	vec3 normal2 = normalize(cross(pos_voisinB - position, pos_voisinC - position));
	vec3 normal3 = normalize(cross(pos_voisinC - position, pos_voisinD - position));
	vec3 normal4 = normalize(cross(pos_voisinD - position, pos_voisinA - position));
	vec3 normal = (normal1 + normal2 + normal3 + normal4)/4.;
	vec3 n = uNormalMatrix * normal;
	v_normal = normalize(n);

	v_position = (uViewMatrix * uModelMatrix * vec4(position, 1.0)).xyz;

	v_texCoord = position_in;
	
	gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`;

//--------------------------------------------------------------------------------------------------------
// FRAGMENT SHADER (GLSL language)
//--------------------------------------------------------------------------------------------------------
var terrain_frag =
    `#version 300 es
precision highp float;

#define M_PI 3.14159265358979

// INPUT
in vec2 v_texCoord;
in vec3 v_position;
in vec3 v_normal;

// UNIFORM
uniform sampler2D uSamplerGrass;
uniform float uLightIntensity;
uniform vec3 uLightPosition;

// OUTPUT
out vec4 oFragmentColor;

// MAIN PROGRAM
void main()
{
	vec3 p = v_position;
	vec3 n = normalize(v_normal);
	vec3 lightDir = uLightPosition - p;
    float d2 = dot(lightDir, lightDir);
    lightDir /= sqrt(d2);
	float diffuseTerm = max(0.0, dot(n, lightDir));

	vec2 uv = mod(5.0 * v_texCoord, 1.0);
	vec4 texColor = texture(uSamplerGrass, uv);
	vec3 Id = uLightIntensity * texColor.rgb * diffuseTerm;
	Id /= M_PI;
	oFragmentColor = vec4(0.2*Id,1);
}
`;

//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
var prgTerrain = null
var vao = null;
var tex_heightmap = null;
var tex_grass = null;

//Terrain
var jMax = 10;
var iMax = 10;
var nbMeshIndices = 0;

//Light
var slider_x;
var slider_y;
var slider_z;
var slider_light_intensity;

//--------------------------------------------------------------------------------------------------------
// Build mesh
//--------------------------------------------------------------------------------------------------------
function buildMesh() {
    iMax = 100;
    jMax = 100;

    // Toujours faire ça
    gl.deleteVertexArray(vao);

    // Store x and y postion of each point
    let data_position = new Float32Array(iMax * jMax * 2);
    for (let j = 0; j < jMax; j++) {
        for (let i = 0; i < iMax; i++) {
            // x
            data_position[2 * (i + j * iMax)] = i / (iMax - 1);
            // y
            data_position[2 * (i + j * iMax) + 1] = j / (jMax - 1);
        }
    }

    // Create VBO
    let vbo_position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_position);
    gl.bufferData(gl.ARRAY_BUFFER, data_position, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Create EBO
    let nbMeshQuads = (iMax - 1) * (jMax - 1);
    let nbMeshTriangles = 2 * nbMeshQuads;
    nbMeshIndices = 3 * nbMeshTriangles;
    let ebo_data = new Uint32Array(nbMeshIndices);
    let current_quad = 0;
    for (let j = 0; j < jMax - 1; j++) {
        for (let i = 0; i < iMax - 1; i++) {
            // triangle 1
            ebo_data[6 * current_quad] = i + j * iMax;
            ebo_data[6 * current_quad + 1] = (i + 1) + j * iMax;
            ebo_data[6 * current_quad + 2] = i + (j + 1) * iMax;
            // triangle 2
            ebo_data[6 * current_quad + 3] = i + (j + 1) * iMax;
            ebo_data[6 * current_quad + 4] = (i + 1) + j * iMax;
            ebo_data[6 * current_quad + 5] = (i + 1) + (j + 1) * iMax;
            current_quad++;
        }
    }
    let ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Create vao
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_position);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

    // Reset states
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function init_wgl() {
    ewgl.continuous_update = true;

    UserInterface.begin();
    UserInterface.use_field_set('H', "Light Position");
    slider_x = UserInterface.add_slider('X ', -100, 100, 0, update_wgl);
    slider_y = UserInterface.add_slider('Y ', -100, 100, 0, update_wgl);
    slider_z = UserInterface.add_slider('Z ', -100, 100, 50, update_wgl);
    UserInterface.end_use();
    UserInterface.use_field_set('H', "Light Intensity");
    slider_light_intensity = UserInterface.add_slider('intensity', 0, 50, 20, update_wgl);
    UserInterface.end_use();
    UserInterface.end();

    prgTerrain = ShaderProgram(terrain_vert, terrain_frag, 'terrain');

    buildMesh();

    tex_heightmap = gl.createTexture();
    const img_terrain = new Image();
    img_terrain.src = 'textures/Heightmap.png';
    img_terrain.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex_heightmap);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img_terrain);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    tex_grass = gl.createTexture();
    const img_grass = new Image();
    img_grass.src = 'textures/grass.png';
    img_grass.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex_grass);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img_grass);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
}

function draw_wgl() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    prgTerrain.bind();

    const viewMatrix = ewgl.scene_camera.get_view_matrix();
    let scaleMatrix = Matrix.scale(0.6);
    const rotationMatrix = Matrix.rotateX(-90);
    const translationMatrix = Matrix.translate(0, 0, -0.8);
    let scaleRotMatrix = Matrix.mult(scaleMatrix, rotationMatrix);
    let modelMatrix = Matrix.mult(scaleRotMatrix, translationMatrix);
    let mvm = Matrix.mult(viewMatrix, modelMatrix);
    let normalMatrix = mvm.inverse3transpose();

    Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
    Uniforms.uViewMatrix = viewMatrix;
    Uniforms.uModelMatrix = modelMatrix;
    Uniforms.uNormalMatrix = normalMatrix;
    Uniforms.uSamplerTerrain = 0;
    Uniforms.uSamplerGrass = 1;
    Uniforms.uLightIntensity = slider_light_intensity.value;
    Uniforms.uLightPosition = mvm.transform(Vec3(slider_x.value, slider_y.value, slider_z.value));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex_heightmap);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex_grass);

    gl.bindVertexArray(vao);

    gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);

    gl.bindVertexArray(null);
    gl.useProgram(null);
}

ewgl.launch_3d();