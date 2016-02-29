/*

  BRIGLV - A wrapper around BRIGL that attempts to recreate
     some of the functionality of LDView. In theory these are
     the more portable parts.

  Hazen Babcock 2016

*/
'use strict';

var BRIGLV = BRIGLV || {
    REVISION: '1'
};

BRIGLV.briglRender = function(model, to_render, callback, errorCallback){
    if (to_render.length > 0){
	var step = to_render.pop();
	BRIGLV.log("rendering " + step.name);
	console.log("rendering " + step.name);
	model.brigl_builder.loadModelByData(step.name,
					    step.data,
					    step.mesh_options,
					    function(mesh){
						step.setMesh(mesh);
						BRIGLV.briglRender(model, to_render, callback, errorCallback);
					    },
					    errorCallback);
    }
    else {
	console.log("loading complete");
	BRIGLV.log("loading complete");
	callback();
    }
}


BRIGLV.log = function(msg){
    console.info("BV " + msg);
}

/*
 * A single part, these are used for
 * rendering the parts list for each step.
 */
BRIGLV.Part = function(part_id, part_name, part_color){
    this.color = part_color;
    this.data = "1 " + part_color + " 0 0 0 1 0 0 0 1 0 0 0 1 " + part_name;
    this.id = part_id;
    this.mesh = undefined;
    this.mesh_options = { drawLines : true };
    this.name = "bv" + part_name;
}

BRIGLV.Part.prototype = {

    constructor: BRIGLV.Part,

    setMesh: function(mesh){
	this.mesh = mesh;
    }
}

/*
 * Usually this is a single step in the model, but it can 
 * also be an entire group. It contains all the LDraw data 
 * necessary for BRIGL to render this piece of the model.
 */
BRIGLV.Step = function(name){
    this.data = "";
    this.mesh = undefined;
    this.mesh_options = { dontCenter : true };
    this.name = name;
    this.parts = {};
}

BRIGLV.Step.prototype = {

    constructor: BRIGLV.Step,

    addLine: function(line){
	this.data = this.data + "\n" + line;
    },

    addPart: function(part){
	if (part.id in this.parts){
	    this.parts[part.id] += 1;
	}
	else{
	    this.parts[part.id] = 1;
	}
    },

    getMesh: function(){
	return this.mesh;
    },
    
    setMesh: function(mesh){
	this.mesh = mesh;
    },

    setName: function(name){
	this.name = name;
    }
}

/*
 * A group in the model, every model has at least one.
 *
 * Step 0 is the entire group. To display a sub-set of
 * the group by steps use steps 1..N.
 */
BRIGLV.Group = function(name){
    this.all_steps = new BRIGLV.Step(name);
    this.cur_step = new BRIGLV.Step(name + "_0");
    this.depends = [];
    this.group_name = name;
    this.steps = [this.all_steps, this.cur_step];
}

BRIGLV.Group.prototype = {
    
    constructor: BRIGLV.Group,

    addLine: function(line) {
	if (line.startsWith("0 STEP")){
	    this.cur_step = new BRIGLV.Step(this.group_name + "_" + (this.steps.length - 1));
	    this.steps.push(this.cur_step);
	}
	else {
	    this.all_steps.addLine(line);
	    this.cur_step.addLine(line);
	}
    },

    addPart: function(part){
	this.cur_step.addPart(part);
    },
    
    getNumberSteps: function(){
	return this.steps.length;
    }
}


/*
 * The whole model.
 */
BRIGLV.Model = function(options){
    this.brigl_builder = new BRIGL.Builder("parts/", options);
    this.errorCallback = undefined;
    this.finishedLoadingCallback = undefined;
    this.group_names = {};
    this.groups = [];
    this.ldraw_parts = {}; // These are parts that are not created in the MPD file.
    this.mesh_options = {};
    this.to_render = [];
}

BRIGLV.Model.prototype = {

    constructor: BRIGLV.Model,

    getGroup: function(group_number){
	
	// group_number range checking.
	if (group_number >= this.groups.length){
	    BRIGLV.log("group number out of range");
	    group_number = this.groups.length - 1;
	}
	if (group_number < 0){
	    BRIGLV.log("group number out of range");
	    group_number = 0;
	}
	
	return this.groups[group_number];
    },

    getGroupNames: function(){
	var group_names = [];
	for (var i = 0; i < this.groups.length; i++){
	    group_names.push(this.groups[i].group_name);
	}

	return group_names;
    },

    getMaxStep: function(group_number){
	return this.getGroup(group_number).getNumberSteps();
    },
    
    getMeshs: function(group_number, step_number){
	var group = this.getGroup(group_number);

	// step_number range checking.
	if (step_number > group.getNumberSteps()){
	    BRIGLV.log("step number out of range");
	    step_number = group.getNumberSteps();
	}
	if (step_number < 2){
	    BRIGLV.log("step number out of range");
	    step_number = 2;
	}

	// Create an array with the meshes.
	var meshs = [];
	for (var i = 1; i < step_number; i++){
	    meshs.push(group.steps[i].getMesh());
	}

	return meshs;
    },

    getParts: function(group_number, step_number){
	var step = this.getGroup(group_number).steps[step_number-1];

	// Get the parts for the current step.
	var parts = [];
	var keys = Object.keys(step.parts);
	for (var i = 0; i < keys.length; i++){
	    // [part mesh, number of this part used at this step]
	    parts.push([this.ldraw_parts[keys[i]].mesh, step.parts[keys[i]]]);
	}
	return parts;
    },
    
    loadModel: function(modelData, callback, errorCallback) {

	var lines = modelData.split("\n");
	// Identify all the sub-files.
	for (var i = 0; i < lines.length; i++){
	    var li = lines[i].trim();
	    if (li === '') continue;

	    if (li.startsWith("0 FILE ")){
		var group_name = li.substring(7).toLowerCase();
		this.group_names[group_name] = true;
	    }
	}

	// Now read in the model, creating separate objects for
	// each group, step and part.
	for (var i = 0; i < lines.length; i++){
	    var li = lines[i].trim();
	    if (li === '') continue;

	    if (li.startsWith("0 FILE ")){
		var group_name = li.substring(7).toLowerCase();
		this.cur_group = new BRIGLV.Group(group_name);
		this.groups.push(this.cur_group);
	    }
	    else {
		this.cur_group.addLine(li);

		// Check if this is a part and add it to the group if it is.
		if (li.startsWith("1")){
		    var li_split = li.split(/(\s+)/);
		    var part_name = li_split.slice(28).join("");
		    var group_name = part_name.toLowerCase();

		    // Check if this part is actually a sub-file.
		    if (!(group_name in this.group_names)){
			var part_color = li_split[2];
			var part_id = part_name + "_" + part_color;
			if (!(part_id in this.ldraw_parts)){
			    this.ldraw_parts[part_id] = new BRIGLV.Part(part_id, part_name, li_split[2]);
			}
			this.cur_group.addPart(this.ldraw_parts[part_id]);
		    }
		    else {
			this.cur_group.depends.push(group_name);
		    }
		}
	    }
	}

	/*
	 * Sort groups by dependence so that they get fed to BRIGL in
	 * the right order.
	 */
	var temp_groups = [];
	for (var i = 0; i < this.groups.length; i++){
	    temp_groups.push(this.groups[i]);
	}
	
	var brigl_order = [];
	while (brigl_order.length < this.groups.length){
	    for (var i = (temp_groups.length - 1); i >= 0; i--){
		var group = temp_groups[i];
		var dependencies_found = true;
		var j = 0;
		while (j < group.depends.length && dependencies_found){
		    var k = 0;
		    while (k < brigl_order.length){
			if (group.depends[j] == brigl_order[k].group_name){
			    k = brigl_order.length + 1;
			}
			k++;
		    }
		    if (k == brigl_order.length){
			dependencies_found = false;
		    }
		    j++;
		}
		if (dependencies_found){
		    brigl_order.push(group);
		    temp_groups.splice(i,1);
		}
	    }
	}
	
	/*
	 * Create a list containing everything that we need BRIGL to render.
	 * These are in the opposite order from which they will be rendered
	 * by BRIGL, so later groups should not have dependencies on
	 * earlier groups.
	 */
	// 'Steps' in the model.
	for (var i = (brigl_order.length - 1); i >= 0; i--){
	    var group = brigl_order[i];
	    console.log(group.group_name);
	    for (var j = 0; j < group.getNumberSteps(); j++){
		this.to_render.push(group.steps[j]);
	    }
	}
	
	// Individual parts (for displaying parts lists).
	var keys = Object.keys(this.ldraw_parts);
	for (var i = 0; i < keys.length; i++){
	    this.to_render.push(this.ldraw_parts[keys[i]]);
	}
	
	// Render it.
	BRIGLV.briglRender(this, this.to_render, callback, errorCallback);

    },

    reset: function(){
	this.groups = [];
    }

}


/*
 * A slightly modified BRIGL.BriglContainer that 
 * can handle handle multiple meshes.
 */
BRIGLV.Container = BRIGL.BriglContainer;

BRIGLV.Container.prototype.setModel = function(meshs, reset_view) {

    var old_mesh = this.mesh;
    
    //
    // Create a group with all the meshs. Fortunately this has
    // enough functionality that BRIGL.Container can use it the
    // same way as a normal mesh.
    //
    this.mesh = new THREE.Object3D();
    for (var i = 0; i < meshs.length; i++){
	this.mesh.add(meshs[i]);
    }

    if (reset_view){
	var radius_delta = 0.0;

	for (var i = 0; i < meshs.length; i++){
	    meshs[i].geometry.computeBoundingSphere();
	    var radius = meshs[i].geometry.boundingSphere.radius + meshs[i].geometry.boundingSphere.center.length();
	    if (radius > radius_delta){
		radius_delta = radius;
	    }
	}
	this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, -0.5).normalize(), 3.34);
	radius_delta = radius_delta/180.0;
	this.camera.position.set(0 * radius_delta, 150 * radius_delta, 400 * radius_delta);
	this.camera.lookAt(this.scene.position);
    }
    else {
	if (old_mesh){
	    this.mesh.position.copy(old_mesh.position);
	    this.mesh.quaternion.copy(old_mesh.quaternion);
	}
    }
    
    this.scene.add(this.mesh);
    if (old_mesh) this.scene.remove(old_mesh);
    
    this.render();
}


/*
 * Container for displaying render of the parts in the parts 
 * list. This simpler because you can't interact with them.
 */
BRIGLV.PartContainer = function(canvas, options) {
    this.camera = 0;
    this.grid1 = 0;
    this.grid2 = 0;
    this.renderer = 0;
    this.scene = 0;
    this.setup(options ? options : {
	canvas: canvas,
        antialias: true
    });
};

BRIGLV.PartContainer.prototype = {

    constructor : BRIGLV.PartContainer,
    
    /*
     * This is basically the setModel() function of BRIGL.BriglContainer.
     */
    setPart: function(part_mesh, orientation){

	if (this.mesh){
	    this.scene.remove(this.mesh);
	}

	this.mesh = part_mesh;
	
	part_mesh.geometry.computeBoundingBox();

	// Rotate part.
	part_mesh.quaternion.setFromAxisAngle(orientation.normalize(), Math.PI / 2);
	
	// Determine a good FOV for the camera.
	var box_max = part_mesh.geometry.boundingBox.max;

	var max_dim = box_max.x;
	if (box_max.y > max_dim){
	    max_dim = box_max.y;
	}
	if (box_max.z > max_dim){
	    max_dim = box_max.z;
	}
	max_dim = 1.3 * max_dim;
	
	this.camera.left = -max_dim;
	this.camera.right = max_dim;
	this.camera.top = max_dim;
	this.camera.bottom = -max_dim;
	this.camera.updateProjectionMatrix();

	// Add mesh to scene.
	this.scene.add(part_mesh);

	// Add appropriate grid based on part size.
	if (max_dim > 200){
	    this.scene.remove(this.grid1);
	    this.scene.add(this.grid2);
	}
	else {
	    this.scene.remove(this.grid2);
	    this.scene.add(this.grid1);
	}
	
	this.renderer.render(this.scene, this.camera);
    },
    
    /*
     * This was lifted more or less straight out of the
     * setup() function of BRIGL.BriglContainer.
     */
    setup: function(options) {
	/*
	 * GRID
	 */
	this.grid1 = new THREE.Object3D();
	this.grid2 = new THREE.Object3D();
	var grid_material = new THREE.LineBasicMaterial({ color: 0x080808 });

	// X lines
	for (var x = -400; x <= 400; x += 20){
	    var geometry = new THREE.Geometry();
	    geometry.vertices.push(new THREE.Vector3(x, -1000, 0));
	    geometry.vertices.push(new THREE.Vector3(x,  1000, 0));
	    var line = new THREE.Line(geometry, grid_material);
	    this.grid1.add(line);
	}

	for (var x = -400; x <= 400; x += 40){
	    var geometry = new THREE.Geometry();
	    geometry.vertices.push(new THREE.Vector3(x, -1000, 0));
	    geometry.vertices.push(new THREE.Vector3(x,  1000, 0));
	    var line = new THREE.Line(geometry, grid_material);
	    this.grid2.add(line);
	}

	// Y lines
	for (var y = -400; y <= 400; y += 20){
	    var geometry = new THREE.Geometry();
	    geometry.vertices.push(new THREE.Vector3(-1000, y, 0));
	    geometry.vertices.push(new THREE.Vector3( 1000, y, 0));
	    var line = new THREE.Line(geometry, grid_material);
	    this.grid1.add(line);
	}

	for (var y = -400; y <= 400; y += 40){
	    var geometry = new THREE.Geometry();
	    geometry.vertices.push(new THREE.Vector3(-1000, y, 0));
	    geometry.vertices.push(new THREE.Vector3( 1000, y, 0));
	    var line = new THREE.Line(geometry, grid_material);
	    this.grid2.add(line);
	}
	
	// SCENE
	this.scene = new THREE.Scene();
	this.scene.add(this.grid1);

	// CAMERA
	this.camera = new THREE.OrthographicCamera(-100.0, 100, 100.0, -100.0, -1000, 1000);

	this.scene.add(this.camera);
	this.camera.position.set(0, 0, 200);
	this.camera.lookAt(this.scene.position);
	
	// RENDERER
	this.renderer = new THREE.WebGLRenderer(options);
	this.renderer.setClearColor( 0xffffff, 1 );

	// LIGHT (lighting could be choosen better)
	var light = new THREE.PointLight(0xffffff);
	light.position.set(0, 250, 0);
	this.scene.add(light);

	var light = new THREE.DirectionalLight(0xaaaaaa);
	light.position.set(0, 0, 100);
	this.scene.add(light);

	/*
	var light = new THREE.DirectionalLight(0xffffff);
	light.position.set(0, 0, 1000);
	this.scene.add(light);

	var light = new THREE.DirectionalLight(0xffffff);
	light.position.set(0, 0, -1000);
	this.scene.add(light);
	*/
    }
}


/*

  The MIT License
  
  Copyright (c) 2016 Hazen Babcock

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*/
