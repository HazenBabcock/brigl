/*

  Javascript that is specific to the brigl_view.html page.

  Hazen Babcock 2016

*/
'use strict';

var builder;
var briglv_container;
var briglv_partcontainer;
var cur_step;
var have_model;
var group_number;
var logarea;
var max_step;
var model;
var mpd_select;
var part_canvases = [];
var part_display;
var step_text_display;
var webgl_canvas;

function handleError(msg)
{
    alert("Error: " + msg);
}

function handleFile(event){
    if (!model) return;
    
    var input = event.target;
    logarea.value = ""
    
    var reader = new FileReader();
    reader.onload = function(){
	model.reset();
	model.loadModel(reader.result,
			function(){
			    group_number = 0;
			    cur_step = max_step = model.getMaxStep(group_number);
			    populateMPDSelect(model.getGroupNames());
			    handleUpdate(group_number, max_step, true);
			    have_model = true;
			},
			handleError);
    };
    reader.readAsText(input.files[0]);       
}

function handleMPDSelect(){
    if (!have_model) return;
    group_number = mpd_select.value;
    cur_step = max_step = model.getMaxStep(group_number);
    handleUpdate(group_number, max_step, true);
}

function handleUpdate(group_number, step_number, reset_view){

    // Render model.
    briglv_container.setModel(model.getMeshs(group_number, step_number), reset_view);

    /*
     * Render parts.
     */
    var parts = model.getParts(group_number, step_number);

    // Don't display more than 20 parts per step under the
    // assumption that this means the model has no steps.
    var parts_length = parts.length;
    if (parts_length > 20){
	parts_length = 20;
    }
    
    // Create the right number of canvases for displaying the parts.
    while (part_canvases.length > (3*parts_length)){
	part_display.removeChild(part_display.lastChild);
	part_canvases.pop();
	part_canvases.pop();
	part_canvases.pop();	
    }
    while (part_canvases.length < (3*parts_length)){
	var new_div = document.createElement("div");
	part_display.appendChild(new_div);

	new_div.style.border = "1px solid black";
	new_div.style.display = "inline-block";

	for (var i = 0; i < 3; i++){
	    var new_canvas = document.createElement("canvas");
	    new_div.appendChild(new_canvas);
	    new_canvas.style.width = "200px";
	    new_canvas.style.height = "200px";
	    new_canvas.style.padding = "5px";
	    part_canvases.push(new_canvas);
	}
    }
    
    // Do the actual rendering.
    for (var i = 0; i < parts_length; i++){

	// Get first canvas and clear.
	var part_context = part_canvases[3*i].getContext("2d");
	part_context.clearRect(0, 0, part_canvases[2*i].width, part_canvases[2*i].height);

	// Draw first orientation.
	var ori = new THREE.Vector3(1, 0, 0);
	briglv_partcontainer.setPart(parts[i][0], ori);
	part_context.drawImage(webgl_canvas, 0, 0);

	// Add number of this type of part.
	part_context.font="30px Georgia";
	part_context.fillText(parts[i][1] + "x", 10, 30);

	// Get second canvas and clear.
	var part_context = part_canvases[3*i+1].getContext("2d");
	part_context.clearRect(0, 0, part_canvases[2*i+1].width, part_canvases[2*i+1].height);
	
	// Draw second orientation.
	var ori = new THREE.Vector3(0, 1, 0);
	briglv_partcontainer.setPart(parts[i][0], ori);
	part_context.drawImage(webgl_canvas, 0, 0);

	// Get third canvas and clear.
	var part_context = part_canvases[3*i+2].getContext("2d");
	part_context.clearRect(0, 0, part_canvases[2*i+1].width, part_canvases[2*i+1].height);
	
	// Draw third orientation.
	var ori = new THREE.Vector3(0, 0, 1);
	briglv_partcontainer.setPart(parts[i][0], ori);
	part_context.drawImage(webgl_canvas, 0, 0);
		
	part_context.stroke();
    }

    // Update part number text.
    step_text_display.textContent = "Showing " + (step_number - 1)  + " of " + (max_step - 1) + " steps"
}

function incStep(delta){
    if (!have_model) return;
    
    cur_step += delta;
    if(cur_step < 2){
	cur_step = 2;
    }
    if(cur_step > max_step){
	cur_step = max_step;
    }
    handleUpdate(group_number, cur_step, false);
}

function init(){
    if ( ! Detector.webgl ) { alert("no webgl"); return; }
    
    have_model = false;
    max_step = 0;

    // Model rendering.
    model = new BRIGLV.Model();
    briglv_container = new BRIGLV.Container(document.getElementById("model"));
    briglv_container.render();

    // Part rendering
    webgl_canvas = document.getElementById("webgl_canvas");
    webgl_canvas.style.visibility = "hidden";
    briglv_partcontainer = new BRIGLV.PartContainer(webgl_canvas);

    // Part display
    part_display = document.getElementById("part_display");

    // Step text
    step_text_display = document.getElementById("current_step");
   
    logarea = document.getElementById("log");
    BRIGL.log = function(msg){
  	logarea.textContent = "BRIGL: " + msg;
    }
    BRIGLV.log = function(msg){
  	logarea.textContent = "BRIGL-View: " + msg;
    }
    
    mpd_select = document.getElementById("mpd_select");
    document.getElementById("mpd").style.visibility = 'hidden';
}

function populateMPDSelect(group_names){
    
    // Clear old options.
    for (var i = mpd_select.options.length-1; i >= 0; i--){
	mpd_select.remove(i)
    }
    
       // Add new options.
    for (var i = 0; i < group_names.length; i++){
	var opt = document.createElement('option');
	opt.innerHTML = group_names[i];
	opt.value = i;
	mpd_select.appendChild(opt);
    }
    
    if (group_names.length > 1){
	document.getElementById("mpd").style.visibility = 'visible';
    }
    else {
	document.getElementById("mpd").style.visibility = 'hidden';
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

