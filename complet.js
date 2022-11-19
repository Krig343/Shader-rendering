"use strict"

//--------------------------------------------------------------------------------------------------------
// VERTEX SHADER
//--------------------------------------------------------------------------------------------------------
// Vertex shader for the env. map
var sky_vert =
	`#version 300 es

// INPUT
layout(location = 0) in vec3 position_in;

// UNIFORM
uniform mat4 projectionviewMatrix;

// OUTPUT
out vec3 tex_coord;

// MAIN PROGRAM
void main()
{
	tex_coord = position_in;
	gl_Position = projectionviewMatrix * vec4(position_in, 1.0);	
}
`;

// Vertex shader for the terrain
var terrain_vert =
	`#version 300 es

// INPUT
layout(location = 0) in vec2 position_in;

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
	// Transformation from 2D vertex to 3D vertex with z from heightmap
	vec3 position = vec3(2.0 * position_in - 1.0, 0.0);
	float terrainHeight = texture(uSamplerTerrain, position_in).r;
	position.z += terrainHeight;

	float step = 1./100.; // Space between two vertices
	
	// Calculating the positions of the current vertex's four 4-connex neighbours
	vec2 voisinA = position_in.xy + vec2(step, 0.0);
	vec2 voisinB = position_in.xy + vec2(0.0, step);
	vec2 voisinC = position_in.xy + vec2(-step, 0.0);
	vec2 voisinD = position_in.xy + vec2(0.0, -step);

	// Calculating the 3D positions of the neighbours
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

	// Calculating the normals of the four triangles around the current vertex
	vec3 normal1 = normalize(cross(pos_voisinA - position, pos_voisinB - position));
	vec3 normal2 = normalize(cross(pos_voisinB - position, pos_voisinC - position));
	vec3 normal3 = normalize(cross(pos_voisinC - position, pos_voisinD - position));
	vec3 normal4 = normalize(cross(pos_voisinD - position, pos_voisinA - position));

	// Calculating the current vertex's normal
	vec3 normal = (normal1 + normal2 + normal3 + normal4)/4.;
	vec3 n = uNormalMatrix * normal;
	v_normal = normalize(n);

	v_position = (uViewMatrix * uModelMatrix * vec4(position, 1.0)).xyz;

	v_texCoord = position_in.xy;
	
	gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`;

// Vertex shader for the water
var water_vert =
	`#version 300 es

// INPUT
layout(location = 0) in vec3 position_in;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

// OUTPUT
out vec3 v_position;
out vec2 v_texCoord;
out vec3 v_normal;
out float refle_coef;

// MAIN PROGRAM
void main()
{
	// Calculating the Fresnel factor
	vec3 normal = vec3 (0.0, 1.0, 0.0);
	vec3 view = normalize(-(uProjectionMatrix * uViewMatrix * vec4(position_in, 1.0)).xyz);
	refle_coef = max(0.0,dot(view, normalize(normal)));
	
	v_texCoord = position_in.xy;
	
	v_position = (uViewMatrix * uModelMatrix * vec4(position_in, 1.0)).xyz;
	
	gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position_in, 1.0);
}
`;

// Vertex shader for the FBO
var fbo_vert =
	`#version 300 es

// OUTPUT
out vec2 v_texCoord;

// MAIN PROGRAM
void main()
{
	// Compute vertex position between [-1;1]
	float x = -1.0 + float((gl_VertexID & 1) << 2); // If VertexID == 1 then x = 1 else x == -1
	float y = -1.0 + float((gl_VertexID & 2) << 1); // If VertexID == 2 then y = 1 else y == -1
	
	vec2 coord = vec2(x, y);
	v_texCoord = coord;
	
	// Send position to clip space
	gl_Position = vec4(coord, 0.0, 1.0);
}
`;

//--------------------------------------------------------------------------------------------------------
// FRAGMENT SHADER (GLSL language)
//--------------------------------------------------------------------------------------------------------
// Fragment shader for the env. map
var sky_frag =
	`#version 300 es

precision highp float;

// INPUT
in vec3 tex_coord;

// UNIFORM
uniform samplerCube TU;

// OUTPUT
out vec4 frag;

// MAIN PROGRAM
void main()
{
	frag = texture(TU, tex_coord);
}
`;

// Fragment shader for the terrain
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
uniform sampler2D uSamplerSand;
uniform float uLightIntensity;
uniform vec3 uLightPosition;

// OUTPUT
out vec4 oFragmentColor;

// FUNCTION
float sdCircle(vec2 p, float r)
{
  	return length(p) - r;
}

// MAIN PROGRAM
void main()
{
	// Diffuse shading
	vec3 p = v_position;
	vec3 n = normalize(v_normal);
	vec3 lightDir = uLightPosition - p;
    float d2 = dot(lightDir, lightDir);
    lightDir /= sqrt(d2);
	float diffuseTerm = max(0.0, dot(n, lightDir));

	// Calculating light intensity depending on the texture
	vec2 uv = v_texCoord;
	float radius = 0.1;
	float d = sdCircle(uv - vec2(0.5), radius);
	if (d > 0.45)
		discard; //discard the outer fragments to form a circled island
	d = sdCircle(uv - vec2(0.52, 0.53), radius);
	vec4 texColor;
	if (d > 0.38 || d < 0.12)
	{
		uv = mod(5.0 * v_texCoord, 1.0);
		texColor = texture(uSamplerSand, uv);
	}
	else
	{
		uv = mod(5.0 * v_texCoord, 1.0);
		texColor = texture(uSamplerGrass, uv);
	}
	vec3 Id = uLightIntensity * texColor.rgb * diffuseTerm;
	Id /= M_PI;

	oFragmentColor = vec4(0.2*Id,1.0);
}
`;

// Fragment shader for the water
var water_frag =
	`#version 300 es
precision highp float;

// INPUT
in vec3 v_position;
in vec2 v_texCoord;
in float refle_coef;

// UNIFORM
uniform sampler2D uRefleSampler;
uniform sampler2D uRefraSampler;

// OUTPUT
out vec4 oFragmentColor;

// FUNCTION
float sdCircle(vec2 p, float r)
{
  	return length(p) - r;
}

// MAIN PROGRAM
void main()
{
	vec2 uv = v_texCoord;
	float radius = 0.1;
	float d = sdCircle(uv - vec2(0.03,0.05), radius);
	if (d > 0.41)
		discard; //discard the outer fragments to match the island hole

	// Calculating and applying the refraction and reflection texture
	vec4 reflection = texture(uRefleSampler, uv);
	vec4 refraction = texture(uRefraSampler, uv);
	vec3 c_reflection = refle_coef * reflection.rgb;
	vec3 c_refraction = (1.0 - refle_coef) * refraction.rgb;
	float r = mix(0.0, 1.0, c_reflection.r + c_refraction.r);
	float g = mix(0.0, 1.0, c_reflection.g + c_refraction.g);
	float b = mix(0.0, 1.0, c_reflection.b + c_refraction.b);
	oFragmentColor = vec4(vec3(r,g,b),1);
}
`;

// Fragment shader for the FBO
var fbo_frag =
	`#version 300 es
precision highp float;

// INPUT
in vec2 v_texCoord;

// UNIFORM
uniform sampler2D uDistoSampler;
uniform float uTime;

// OUTPUT
layout(location = 0) out vec4 oRefleColor;
layout(location = 1) out vec4 oRefraColor;

void main()
{
	// Calculating the distortion coordinates
	vec2 tex_pos = 0.5 * v_texCoord + 0.5; //bring back between [0,1]
	tex_pos = mod(8.0 * tex_pos, 1.0); //tiling
	vec4 texColor = texture(uDistoSampler, tex_pos);
	vec2 disto_pos = 2.0 * texColor.xy - 1.0; //bring back between [-1,1]
	disto_pos /= 50.;

	vec2 texCoord = v_texCoord + disto_pos * sin(uTime);
	vec2 uv = mod(5.0 * texCoord, 1.0);
	
	oRefleColor = vec4(0.0, uv, 1.0);

	oRefraColor = vec4(uv, 0.0, 1.0);
}
`;

//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
// Terrain
var prgTerrain = null
var terrain_vao = null;
var tex_heightmap = null;
var tex_grass = null;
var tex_sand = null;

// Terrain building
var jMax = 10;
var iMax = 10;
var nbMeshIndices = 0;

// Light
var slider_x;
var slider_y;
var slider_z;
var slider_light_intensity;

// Skybox
var prg_envMap = null;
var tex_envMap = null;
var sky_rend = null;

// Water
var prgWater = null;
var water_vao = null;

// FBO
var fbo = null;
var tex_refle = null;
var tex_refra = null;
var fboTexWidth = 1024;
var fboTexHeight = 1024;
var fbo_prg = null;

// Distortion
var tex_disto = null;

//--------------------------------------------------------------------------------------------------------
// Build terrain mesh
//--------------------------------------------------------------------------------------------------------
function buildTerrainMesh() {
	iMax = 100;
	jMax = 100;

	gl.deleteVertexArray(terrain_vao);

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
	terrain_vao = gl.createVertexArray();
	gl.bindVertexArray(terrain_vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_position);
	let vertexAttributeID = 0;
	let dataSize = 2;
	let dataType = gl.FLOAT;
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
	gl.enableVertexAttribArray(vertexAttributeID);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

	// Reset states
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function buildWaterMesh() {
	gl.deleteVertexArray(water_vao);

	// Store x, y and z postion of each corner
	let data_positions = new Float32Array(
		[-0.45, -0.6, 0.0,
			0.55, -0.6, 0.0,
			0.55, 0.55, 0.0,
		-0.45, 0.55, 0.0]
	)

	// Create VBO
	let vbo_positions = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	// Create EBO
	let ebo_data = new Uint32Array(6);
	ebo_data[0] = 0;
	ebo_data[1] = 1;
	ebo_data[2] = 2;
	ebo_data[3] = 2;
	ebo_data[4] = 3;
	ebo_data[5] = 0;
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	// Create VAO
	water_vao = gl.createVertexArray();
	gl.bindVertexArray(water_vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	let vertexAttributeID = 0;
	let dataSize = 3;
	let dataType = gl.FLOAT;
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
	gl.enableVertexAttribArray(vertexAttributeID);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

	// Reset States
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function init_wgl() {
	ewgl.continuous_update = true;

	// Create user interface for light position and intensity
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

	// Shader program initialisation
	prgTerrain = ShaderProgram(terrain_vert, terrain_frag, 'terrain shader');
	prg_envMap = ShaderProgram(sky_vert, sky_frag, 'sky');
	prgWater = ShaderProgram(water_vert, water_frag, 'water shader');
	fbo_prg = ShaderProgram(fbo_vert, fbo_frag, 'fbo shader');

	buildTerrainMesh(); // Terrain building
	buildWaterMesh(); // Water building

	// Create texture for vertex z value
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

	// Create grass texture for terrain application
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

	// Create sand texture for terrain application
	tex_sand = gl.createTexture();
	const img_sand = new Image();
	img_sand.src = 'textures/sand.png';
	img_sand.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D, tex_sand);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img_sand);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindTexture(gl.TEXTURE_2D, null);
	};

	// Create texture and mesh for skybox
	tex_envMap = TextureCubeMap();
	tex_envMap.load(["textures/skybox/right.bmp", "textures/skybox/left.bmp",
		"textures/skybox/top.bmp", "textures/skybox/bottom.bmp",
		"textures/skybox/front.bmp", "textures/skybox/back.bmp"]).then(update_wgl);
	sky_rend = Mesh.Cube().renderer(0, -1, -1);
	ewgl.scene_camera.set_scene_center(Vec3(0, 0, 0));

	// Create fbo textures
	// Reflection texture
	tex_refle = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex_refle);
	let level = 0;
	let internalFormat = gl.RGBA32F;
	let border = 0;
	let format = gl.RGBA;
	let type = gl.FLOAT;
	let data = null;
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, fboTexWidth, fboTexHeight, border, format, type, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.bindTexture(gl.TEXTURE_2D, null);

	// Refraction texture
	tex_refra = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex_refra);
	level = 0;
	internalFormat = gl.RGBA32F;
	border = 0;
	format = gl.RGBA;
	type = gl.FLOAT;
	data = null;
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, fboTexWidth, fboTexHeight, border, format, type, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.bindTexture(gl.TEXTURE_2D, null);

	// Create FBO
	fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	let target = gl.FRAMEBUFFER;
	let textarget = gl.TEXTURE_2D;
	level = 0;
	let attachment = gl.COLOR_ATTACHMENT0;
	gl.framebufferTexture2D(target, attachment, textarget, tex_refle, level);
	attachment = gl.COLOR_ATTACHMENT1;
	gl.framebufferTexture2D(target, attachment, textarget, tex_refra, level);
	let depthRednerBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, depthRednerBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, fboTexWidth, fboTexHeight);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRednerBuffer);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	// Create distortion map texture
	tex_disto = gl.createTexture();
	const img_disto = new Image();
	img_disto.src = 'textures/distortion_map.png';
	img_disto.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D, tex_disto);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img_disto);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.bindTexture(gl.TEXTURE_2D, null);
	};

	// Clear GL states
	gl.clearColor(0, 0, 0, 1);
	gl.enable(gl.DEPTH_TEST);
}

function draw_wgl() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	//--------------------------------------------------------------------------
	// WATER Rendering
	//--------------------------------------------------------------------------
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); //bind FBO
	gl.viewport(0, 0, fboTexWidth, fboTexHeight); //set viewport on texture size
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// 1st pass-----------------------------------------------------------------
	fbo_prg.bind();

	gl.activeTexture(gl.TEXTURE0); //activate and bind distortion map
	gl.bindTexture(gl.TEXTURE_2D, tex_disto);

	Uniforms.uDistoSampler = 0;
	Uniforms.uTime = ewgl.current_time;

	gl.drawArrays(gl.TRIANGLES, 0, 3); //draw one big triangle for fullscreen

	gl.useProgram(null);

	// 2nd pass-----------------------------------------------------------------
	gl.bindFramebuffer(gl.FRAMEBUFFER, null); //ubind FBO
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); //reset viewport
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	prgWater.bind();

	const viewMatrix = ewgl.scene_camera.get_view_matrix();
	const scaleMatrix = Matrix.scale(0.6);
	const rotationMatrix = Matrix.rotateX(-90);
	let modelMatrix = Matrix.mult(scaleMatrix, rotationMatrix);

	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = viewMatrix;
	Uniforms.uModelMatrix = modelMatrix;

	gl.activeTexture(gl.TEXTURE0); //activate and bind reflection texture
	gl.bindTexture(gl.TEXTURE_2D, tex_refle);
	gl.activeTexture(gl.TEXTURE1); //activate and bind refraction texture
	gl.bindTexture(gl.TEXTURE_2D, tex_refra);

	Uniforms.uRefleSampler = 0;
	Uniforms.uRefraSampler = 1;

	gl.bindVertexArray(water_vao);

	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0); //render the water plan quad

	gl.bindVertexArray(null);
	gl.useProgram(null);

	//--------------------------------------------------------------------------
	// SKYBOX Rendering
	//--------------------------------------------------------------------------
	prg_envMap.bind();

	Uniforms.projectionviewMatrix = ewgl.scene_camera.get_matrix_for_skybox();
	Uniforms.TU = tex_envMap.bind(0);

	sky_rend.draw(gl.TRIANGLES);

	gl.useProgram(null);

	//--------------------------------------------------------------------------
	// TERRAIN Rendering
	//--------------------------------------------------------------------------
	prgTerrain.bind();

	const translationMatrix = Matrix.translate(0, 0, -0.8);
	let scaleRotMatrix = Matrix.mult(scaleMatrix, rotationMatrix);
	modelMatrix = Matrix.mult(scaleRotMatrix, translationMatrix);
	let mvm = Matrix.mult(viewMatrix, modelMatrix);
	let normalMatrix = mvm.inverse3transpose();

	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = viewMatrix;
	Uniforms.uModelMatrix = modelMatrix;
	Uniforms.uNormalMatrix = normalMatrix;
	Uniforms.uLightIntensity = slider_light_intensity.value;
	Uniforms.uLightPosition = mvm.transform(Vec3(slider_x.value, slider_y.value, slider_z.value));

	gl.activeTexture(gl.TEXTURE0); //activate and bind heightmap
	gl.bindTexture(gl.TEXTURE_2D, tex_heightmap);
	gl.activeTexture(gl.TEXTURE1); //activate and bind grass texture
	gl.bindTexture(gl.TEXTURE_2D, tex_grass);
	gl.activeTexture(gl.TEXTURE2); //activate and bind sand texture
	gl.bindTexture(gl.TEXTURE_2D, tex_sand);

	Uniforms.uSamplerTerrain = 0;
	Uniforms.uSamplerGrass = 1;
	Uniforms.uSamplerSand = 2;

	gl.bindVertexArray(terrain_vao);

	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);

	gl.bindVertexArray(null);
	gl.useProgram(null);
}

ewgl.launch_3d();