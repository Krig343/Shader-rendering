"use strict"

var sky_vert =
    `#version 300 es

layout(location = 0) in vec3 position_in;
out vec3 tex_coord;
uniform mat4 projectionviewMatrix;

void main()
{
	tex_coord = position_in;
	gl_Position = projectionviewMatrix * vec4(position_in, 1.0);	
}
`;

var sky_frag =
    `#version 300 es

precision highp float;
in vec3 tex_coord;
out vec4 frag;
uniform samplerCube TU;

void main()
{
	frag = texture(TU, tex_coord);
}
`;

var prg_envMap = null;
var tex_envMap = null;
var sky_rend = null;

function init_wgl() {
    ewgl.continuous_update = true;
    tex_envMap = TextureCubeMap();
    tex_envMap.load(["textures/skybox/right.bmp", "textures/skybox/left.bmp",
        "textures/skybox/top.bmp", "textures/skybox/bottom.bmp",
        "textures/skybox/front.bmp", "textures/skybox/back.bmp"]).then(update_wgl);
    prg_envMap = ShaderProgram(sky_vert, sky_frag, 'sky');
    sky_rend = Mesh.Cube().renderer(0, -1, -1);
    ewgl.scene_camera.set_scene_center(Vec3(0, 0, 0));
}

function draw_wgl() {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    prg_envMap.bind();
    Uniforms.projectionviewMatrix = ewgl.scene_camera.get_matrix_for_skybox();
    Uniforms.TU = tex_envMap.bind(0);
    sky_rend.draw(gl.TRIANGLES);

    gl.useProgram(null);
}

ewgl.launch_3d();