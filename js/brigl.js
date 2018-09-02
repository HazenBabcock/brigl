/*

    BRIGL - A library to parse and render LDraw models with WEBGL.

    Copyright (C) 2012  Nicola MSX Lugato
    Copyright (C) 2016  Hazen Babcock

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

                Revision 6:
                - Handle touch events.
		- Updated to work with three.js r74.

		Revision 5:
		- Better error handling
		- Support for jQuery instead of prototype
		- more options

		Revision 4:
		- Animation support
		- Colored lines
		- Various fixings

		Revision 3:
		- Better step support
		- Better handling of non-BFC certified parts
		- More optimized vertex merging
		- Added smoothing of faces based on Conditional Lines
		- Various fixings

		Revision 2:
		- Added zoom and padding
		- Added mesh centering and vertex merging
		- Added crude line handling (no conditionals)
		- Added experimental step support
		- Default color now 16.
		
		TODO:
		- restore centering of the model
		- choose better colors?
		- handle name with spaces

*/
'use strict';

var BRIGL = BRIGL || {
    REVISION: '6'
};

BRIGL.log = function(msg) {
    console.info(msg);
};

if (typeof String.prototype.trim != 'function') {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
};

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function(str) {
        return this.slice(0, str.length) == str;
    };
};

function xclone(xxx) {
    var target = {};
    Object.keys(xxx).map(function(kkk) {
        target[kkk] = xxx[kkk];
    });
    return target;
};


BRIGL.AnimationDef = function() {
    this.type = ""; // ROTATE, TRANSLATE (maybe SCALE?)
    this.mesh = undefined; // mesh to be animated
    this.vector = undefined; // axis for rotation or delta for translation
    this.scalar = 0.0; // angle for rotations, or unused
    this.interpolator = undefined; // interpolation function, see http://sole.github.com/tween.js/examples/03_graphs.html

};

BRIGL.AnimationDef.prototype = {
    constructor: BRIGL.AnimationDef,
    parse: function(defstr, meshFiller) {
        // sample: top ROTATE 0 0 1 90 Elastic.Out
        var tok = defstr.split(' ');


        this.mesh = meshFiller.animatedMesh[tok[0]];
        this.type = tok[1];
        this.vector = new THREE.Vector3(parseFloat(tok[2]), parseFloat(tok[3]), parseFloat(tok[4]));
        this.scalar = parseFloat(tok[5]);
        // silly way to obtain Easing
        var intname = tok[6].split('.');
        var obj = TWEEN.Easing;
        for (var i = 0; i < intname.length; i++) {
            obj = obj[intname[i]];
        }
        this.interpolator = obj;

    },
    getFunction: function() {
        if (this.type === 'ROTATE') {
            var qStart = new THREE.Quaternion();
            qStart.copy(this.mesh.quaternion);


            return (function(value) {
                var qMult = new THREE.Quaternion();
                qMult.setFromAxisAngle(this.vector, this.interpolator(value) * this.scalar);
                this.mesh.quaternion.multiplyQuaternions(qStart, qMult);

                // cont.render();

            }).bind(this);
        } else if (this.type === 'TRANSLATE') {
            var vStart = new THREE.Vector3();
            vStart.copy(this.mesh.position);


            return (function(value) {
                var vDelta = new THREE.Vector3();
                vDelta.copy(this.vector);
                vDelta.multiplyScalar(this.interpolator(value));

                this.mesh.position.addVector(vStart, vDelta);
                this.mesh.updateMatrix();

            }).bind(this);

        }
    }
};


BRIGL.Animation = function() {
    this.name = ""; // name of animation
    this.duration = 0; // milliseconds
    this.state = "ENABLED"; // enabled, disabled, visible
    this.defs = []; // definitions
    this.toggle = []; // other animations to enable/disable
    this.chain = []; // other animations to chain
    this.mesh = undefined; // the mesh that contains this animation
};

BRIGL.Animation.prototype = {
    constructor: BRIGL.Animation,
    getTween: function(container, onCompleteCB) {
        var position = {
            v: 0.0
        };
        var target = {
            v: 1.0
        };
        var funcs = [];

        this.tween = new TWEEN.Tween(position).to(target, this.duration);

        this.tween.onStart((function() {
            // delay getFunction to the start of animation, else it won't work for chained anims as they pick initial values at start
            this.defs.forEach(function(de) {
                funcs.push(de.getFunction())
            });
        }).bind(this));
        this.tween.onUpdate((function() {
            for (var i = 0; i < funcs.length; i++) {
                funcs[i](position.v);
            }
            container.render();

        }).bind(this));

        this.tween.easing(TWEEN.Easing.Linear.None); // here i use linear, AnimationDefs will translate with their interpolator

        if (this.chain.length == 0) {
            // attach callback only if we are the last of a chain, else pass along to chained
            if (onCompleteCB) this.tween.onComplete((function() {
                onCompleteCB(this);
            }).bind(this));
        } else {
            for (var i = 0; i < this.chain.length; i++) {
                var chainedAnim = this.mesh.brigl.animations[this.chain[i]];
                var tw = chainedAnim.getTween(container, onCompleteCB);
                this.tween.chain(tw);
            }
        }
        return this.tween;
    },
    start: function(container, onComplete) {
        this.getTween(container, onComplete); // setup tween
        this.tween.start();
    }
};


// an object used to build up the geometry when we have all pieces
BRIGL.MeshFiller = function() {
    // constructor
    this.verticesMap = {}; // vertices hashmap, for fast access. We store the index of verticeArray
    this.verticesArray = []; // for indexing.
    this.faces = [];
    this.lines = {}; // dictionary color:array, contain vertices for line geometry, separated by color
    this.edgeMap = {}; //used to calculate smoothing with conditional lines
    this.wantsLines = false; // are we interested in reading lines (type2) informations?
    this.blackLines = false; // lines all black ?
    this.inverting = false; // are we currently inverting? (BFC INVERTNEXT)
    this.precisionPoints = 4; // number of decimal points, eg. 4 for epsilon of 0.0001
    this.precision = Math.pow(10, this.precisionPoints);
    this.animatedMesh = {}; // contains a map name:Mesh with animable subparts
    this.animations = {}; // contains a map name:Animations with all animations
    this.options = undefined; // store options
};

BRIGL.MeshFiller.prototype = {
    constructor: BRIGL.MeshFiller,
    // Used for fast, order-irrelevant indexing of edges.
    edgeMapKey: function(idx1, idx2) {
        return Math.min(idx1, idx2) + ":" + Math.max(idx1, idx2)
    },
    // Merge two dictionaries into the first dictionary. Any keys that are common
    // will have the values that are in second dictionary.
    //
    // This is designed to be used in the smoothing algorithm where we don't
    // care what the values are, only that they are defined.
    //
    mergeDicts: function (d1, d2) {
	Object.keys(d2).map(function(key){
	    d1[key] = d2[key];
	});
	return d1;
    },
    // Return the index of the group that contains key, or -1 if key is
    // not in any of the dictionaries.
    //
    // grp_list is a list of dictionaries, [{}, {}, ..].
    //
    whichGroup: function (grp_list, key){
	for (var i = 0; i < grp_list.length; i++){
	    if (grp_list[i][key]){
		return i;
	    }
	}
	return -1;
    },
    addVertice: function(v) {
	//
        // Add a vertice to the geometry returning the index in the array. If a vertex close enough
	// exists, that one is returned and no vertices are added. Each vertex has a unique ID number
	// which is also the index into verticesArray[].
	//
        var key = [Math.round(v.x * this.precision), Math.round(v.y * this.precision), Math.round(v.z * this.precision)].join('_');
        var res = this.verticesMap[key];
        if (res === undefined) {
            // new vertice
            res = this.verticesArray.length;
            this.verticesMap[key] = res;     // Store index for vertice V (since is new will be bottom of array)
            this.verticesArray.push(v);
        }
        return res;
    },
    addFace: function(ccw, certified, det, color, v0, v1, v2, v3) {
        if (!certified) {
            // supertrick to create 1 or 2 additional inverted faces if not certified, this problably breaks the smoothing algorithm.
            this.addFace(false, true, det, color, v2, v1, v0, v3);
            ccw = true;
        }
        var isQuad = (v3 !== undefined);
        // decide if the face should be flipped. Flipping is cumulative,
        // is done if we are inverting geometry (INVERTNEXT), the matrix determinant is negative (ie mirroring)
        // or the face is defined CW.
        var flip = this.inverting ^ (det < 0.0) ^ (!ccw); // kungfu

        var idx1 = this.addVertice(flip ? v2 : v0);
        var idx2 = this.addVertice(v1);
        var idx3 = this.addVertice(flip ? v0 : v2);

        if (isQuad) {
	    var idx4 = this.addVertice(v3);

	    var f1 = new THREE.Face3(idx1, idx2, idx3);
	    f1.isQuad = true;
	    f1.materialIndex = BRIGL_MATERIALS_MAPPING[color];
            if (f1.materialIndex === undefined) {
		BRIGL.log("Unknown material " + color);
		f1.materialIndex = BRIGL_MATERIALS_MAPPING[0];
            }
	    this.faces.push(f1);

	    var f2 = new THREE.Face3(idx1, idx3, idx4);
	    f2.materialIndex = BRIGL_MATERIALS_MAPPING[color];
            if (f2.materialIndex === undefined) {
		BRIGL.log("Unknown material " + color);
		f2.materialIndex = BRIGL_MATERIALS_MAPPING[0];
            }
	    this.faces.push(f2);
	}
	else {
            var fa = new THREE.Face3(idx1, idx2, idx3);
	    fa.materialIndex = BRIGL_MATERIALS_MAPPING[color];
            if (fa.materialIndex === undefined) {
		BRIGL.log("Unknown material " + color);
		fa.materialIndex = BRIGL_MATERIALS_MAPPING[0];
	    }
            this.faces.push(fa);
	}
    },
    addLine: function(v1, v2, color) {
        if (this.blackLines) color = 0; // if wants all black, just use always 0 as color
        var arr = this.lines[color];
        if (!arr) {
            arr = [];
            this.lines[color] = arr;
        }
        arr.push(v1);
        arr.push(v2);
    },
    addCondLine: function(v1, v2) {
        var idx1 = this.addVertice(v1);
        var idx2 = this.addVertice(v2);
        var key = this.edgeMapKey(idx1, idx2);
        this.edgeMap[key] = {};
    },
    smooth: function(geometrySolid) {
	//
	// 1. Create map for the vertices containing information about which faces and
	//    conditional lines contact this vertex
	//

	//
        // This is an array with a Vertex Idx as index and an array as value. The array is an
	// array of arrays in the form [[f1, [b], 1], [f2, [b, c], 1], ..], where the
	// first element of each array if the face, the second is the vertices that contact this
	// vertex that are at the other end of conditional lines, the third is the vertex ID and
	// 1/0 is for dealing with the challenge of creating quads from triangles.
	//
        var vertexGroupsToBeSmoothedMap = {};

        for (var i = 0; i < geometrySolid.faces.length; i++) {
            var f = geometrySolid.faces[i];

	    // Handle quads
	    //
	    // Note quads are arranged like this:
	    //
	    // a/a------c(d)
	    //  | \  f2 |
	    //  |   \   |
	    //  | f   \ |
	    //  b------c/b
	    //
            if (f.isQuad) {
		i += 1;
		var f2 = geometrySolid.faces[i];
		
                // Set all vertex normal equals to face normal
                f.vertexNormals = [f.normal.clone(), f.normal.clone(), f.normal.clone()];
		f2.vertexNormals = [f2.normal.clone(), f2.normal.clone(), f2.normal.clone()];
		
                // Calculate keys of the four edges, we'll compare these against this.edgeMap
		// to look for conditional lines.
                var kab = this.edgeMapKey(f.a, f.b);
                var kbc = this.edgeMapKey(f.c, f.b);
                var kcd = this.edgeMapKey(f2.b, f2.c);
                var kda = this.edgeMapKey(f2.c, f2.a);

		// For each vertex, check if one or both lines are also conditional lines.
		//
		
		// f.a / f2.a
		//
                if ((this.edgeMap[kab])||(this.edgeMap[kda]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kab]){
			edps.push(f.b);
		    }
		    if (this.edgeMap[kda]){
			edps.push(f2.c);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.a]) vertexGroupsToBeSmoothedMap[f.a] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.a].push([f, edps, 0, 1]);
		    vertexGroupsToBeSmoothedMap[f.a].push([f2, edps, 0, 0]);
                }

		// f.b
		//
                if ((this.edgeMap[kab])||(this.edgeMap[kbc]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kab]){
			edps.push(f.a);
		    }
		    if (this.edgeMap[kbc]){
			edps.push(f.c);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.b]) vertexGroupsToBeSmoothedMap[f.b] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.b].push([f, edps, 1, 1]);
                }

		// f.c / f2.b
		//
                if ((this.edgeMap[kbc])||(this.edgeMap[kcd]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kbc]){
			edps.push(f.b);
		    }
		    if (this.edgeMap[kcd]){
			edps.push(f2.c);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.c]) vertexGroupsToBeSmoothedMap[f.c] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.c].push([f, edps, 2, 1]);
		    vertexGroupsToBeSmoothedMap[f.c].push([f2, edps, 1, 0]);
                }
		
		// f2.c
		//
                if ((this.edgeMap[kcd])||(this.edgeMap[kda]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kcd]){
			edps.push(f.c);
		    }
		    if (this.edgeMap[kda]){
			edps.push(f.a);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f2.c]) vertexGroupsToBeSmoothedMap[f2.c] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f2.c].push([f2, edps, 2, 1]);
                }
            }
	    // Handle triangles.
	    //
	    //  a
	    //  | \
	    //  |   \
	    //  | f   \
	    //  b------c
	    //
	    else {
                // Set all vertex normal equals to face normal.
                f.vertexNormals = [f.normal.clone(), f.normal.clone(), f.normal.clone()];
		
                // Calculate keys of the three edges.
                var kab = this.edgeMapKey(f.a, f.b);
                var kbc = this.edgeMapKey(f.c, f.b);
                var kca = this.edgeMapKey(f.a, f.c);

		// Check each vertex for conditional lines.
		//
		
		// f.a
		//
                if ((this.edgeMap[kab])||(this.edgeMap[kca]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kab]){
			edps.push(f.b);
		    }
		    if (this.edgeMap[kca]){
			edps.push(f.c);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.a]) vertexGroupsToBeSmoothedMap[f.a] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.a].push([f, edps, 0, 1])
                }
		
		// f.b		
		//
                if ((this.edgeMap[kab])||(this.edgeMap[kbc]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kab]){
			edps.push(f.a);
		    }
		    if (this.edgeMap[kbc]){
			edps.push(f.c);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.b]) vertexGroupsToBeSmoothedMap[f.b] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.b].push([f, edps, 1, 1]);
                }

		// f.c
		//
                if ((this.edgeMap[kbc])||(this.edgeMap[kca]))
                {
		    // Add endpoints of edges that are conditional lines.
		    var edps = [];
		    if (this.edgeMap[kbc]){
			edps.push(f.b);
		    }
		    if (this.edgeMap[kca]){
			edps.push(f.a);
		    }
			
                    // Ensure array exists
                    if (!vertexGroupsToBeSmoothedMap[f.c]) vertexGroupsToBeSmoothedMap[f.c] = [];

		    // Add vertex.
		    vertexGroupsToBeSmoothedMap[f.c].push([f, edps, 2, 1]);
                }
            }
        }

	//
	// 2. For each vertex we identify groups of faces that share conditional lines, then calculate
	//    a single vertex normal for each group of faces.
	//
        Object.keys(vertexGroupsToBeSmoothedMap).map((function(key) {
            var vertexGroup = vertexGroupsToBeSmoothedMap[key];

	    // First create a list of dictionaries. The keys of the dictionary will be the edges that
	    // are common to the faces that will be grouped together for smoothing.
	    //
	    var smoothGroupsMaps = [];
	    for (var i = 0; i < vertexGroup.length; i++) {
		var vgArray = vertexGroup[i];
		var vgEdps = vgArray[1];

		// If there is only one edge then check if there is already a group that contains this
		// edge. Create a new group if not.
		if (vgEdps.length == 1){
		    var i_grp = this.whichGroup(smoothGroupsMaps, vgEdps[0]);

		    // Create a new group if one does not already exist.
		    if (i_grp == -1){
			var grp_dict = {};
			grp_dict[vgEdps[0]] = 1;
			smoothGroupsMaps.push(grp_dict);
		    }
		}

		// If there are two edges this is a little more complicated because if they are each in
		// different groups then we have to merge the two groups into a single group and discard
		// one of the old groups.
		else {
		    var i1_grp = this.whichGroup(smoothGroupsMaps, vgEdps[0]);
		    var i2_grp = this.whichGroup(smoothGroupsMaps, vgEdps[1]);

		    // Neither are in group, create a new group with both of them.
		    if ((i1_grp == -1) && (i2_grp == -1)){
			var grp_dict = {};
			grp_dict[vgEdps[0]] = 1;
			grp_dict[vgEdps[1]] = 1;
			smoothGroupsMaps.push(grp_dict);
		    }
		    // Only one is in a group, add the other to the same group.
		    else if ((i1_grp > -1) && (i2_grp == -1)){
			smoothGroupsMaps[i1_grp][vgEdps[1]] = 1;
		    }
		    // Only one is in a group, add the other to the same group.
		    else if ((i1_grp == -1) && (i2_grp > -1)){
			smoothGroupsMaps[i2_grp][vgEdps[0]] = 1;
		    }
		    // They are in different groups. Add everything in the second dictionary
		    // to the first dictionary and remove the second dictionary.
		    else if (i1_grp != i2_grp){
			this.mergeDicts(smoothGroupsMaps[i1_grp], smoothGroupsMaps[i2_grp]);
			smoothGroupsMaps.splice(i2_grp, 1);
		    }
		}
	    }

	    // Now create smoothing groups. This is an array of arrays, [[vg1, vg2], [..]]. The elements
	    // (vg1, vg2, ..) contain the face data in the same form as in vertexGroupsToBeSmoothedMap.
	    //
	    var smoothGroups = [];
	    for (var i = 0; i < smoothGroupsMaps.length; i++){
		smoothGroups.push([]);
	    }
	    
	    for (var i = 0; i < vertexGroup.length; i++) {
		var vgArray = vertexGroup[i];
		var vgEdps = vgArray[1];
		var i_grp = this.whichGroup(smoothGroupsMaps, vgEdps[0]);
		smoothGroups[i_grp].push(vgArray);
	    }

	    // Iterate over all smooth groups.
	    //
	    for (var i = 0; i < smoothGroups.length; i++){
		var smoothGroup  = smoothGroups[i];
		
		// Iterate over group summing up the normals.
		//
		var smoothedVector = new THREE.Vector3(0, 0, 0);
		for (var j = 0; j < smoothGroup.length; j++){
                    var vgArray = smoothGroup[j];
		    if (vgArray[3] == 1){
			var face = vgArray[0];
			var vertexIdx = vgArray[2];
			
			smoothedVector.add(face.vertexNormals[vertexIdx]);
		    }
		}

		// Normalize.
		smoothedVector.normalize();
		
		// Use the same vector for all of the faces that are smoothed together
		// at this vertex.
		//
		for (var j = 0; j < smoothGroup.length; j++) {
                    var vgArray = smoothGroup[j];
                    var face = vgArray[0];
                    var vertexIdx = vgArray[2];		    
                    face.vertexNormals[vertexIdx].copy(smoothedVector);
		}
	    }
        }).bind(this));
    },
    buildLineGeometry: function(lineVertices, material, dontCenter) {
        var geometryLines = new THREE.Geometry();
        geometryLines.vertices = lineVertices;
        // apply the same offset to geometryLines, thanks Three.js for returning it :P
        //if(!dontCenter)geometryLines.vertices.forEach(function(v){v.addSelf(offset);});

        // var lineMat = new THREE.LineBasicMaterial({linewidth:3.0, color : 0x000000});
        //var obj3dLines = new THREE.Line(geometryLines, material, THREE.LineSegments);
	var obj3dLines = new THREE.LineSegments(geometryLines, material);
        return obj3dLines;
    },
    partToMesh: function(partSpec, options, isRoot) {
        this.options = options;
        var drawLines = options.drawLines ? options.drawLines : false;
        var stepLimit = options.stepLimit ? options.stepLimit : -1;
        var dontCenter = options.dontCenter ? options.dontCenter : false;
        var centerOffset = options.centerOffset ? options.centerOffset : undefined;
        var dontSmooth = options.dontSmooth ? options.dontSmooth : undefined;
        var blackLines = options.blackLines ? options.blackLines : false;
        var startColor = options.startColor ? options.startColor : 16;

        var transform = options.startingMatrix ? options.startingMatrix : new THREE.Matrix4();

        var geometrySolid = new THREE.Geometry();

        this.wantsLines = drawLines;
        this.blackLines = blackLines;

        partSpec.fillMesh(transform, startColor, this, stepLimit);

        geometrySolid.vertices = this.verticesArray;
        geometrySolid.faces = this.faces;

        // SMOOTHING
	geometrySolid.computeFaceNormals();
        if (!dontSmooth) {
            this.smooth(geometrySolid);
        }
	
        var mat = new THREE.MeshFaceMaterial(BRIGL_MATERIALS());
	var obj3d = new THREE.Mesh(geometrySolid, mat);

        if (drawLines) {
            if (this.blackLines) {
                var obj3dLines = this.buildLineGeometry(this.lines[0], new THREE.LineBasicMaterial({
                    linewidth: 3.0,
                    color: 0x000000
                }), offset, dontCenter);
                obj3d.add(obj3dLines);
            } else {
                var materials = BRIGL_MATERIALS_EDGES();
                Object.keys(this.lines).map((function(colKey) {
                    var material = materials[BRIGL_MATERIALS_MAPPING[colKey]];
                    var obj3dLines = this.buildLineGeometry(this.lines[colKey], material, dontCenter);
                    obj3d.add(obj3dLines);
                }).bind(this));
            }
        }

        //add submesh for animations
        Object.keys(this.animatedMesh).map((function(key) {
            if (this.animatedMesh[key].parent === null) // as this contains all submodels (also subsubmodels), i check first if they aren't already added
            {
                obj3d.add(this.animatedMesh[key]);
            }
        }).bind(this));

        // add a link back to the object for animations, it will be needed later to chain them
        Object.keys(this.animations).map((function(key) {

            this.animations[key].mesh = obj3d;

        }).bind(this));


        // add some data to remember it.
        var brigl = {
            part: partSpec,
            offset: new THREE.Vector3(0, 0, 0),
            animatedMesh: this.animatedMesh,
            animations: this.animations,
            radius: 0.0
        };

        obj3d.brigl = brigl;
	
        // centering.
        if (isRoot && (!dontCenter)) {
            if (centerOffset) {
                brigl.offset.copy(centerOffset);
            }
	    else {
		var box = new THREE.Box3().setFromObject(obj3d);
		var offset = new THREE.Vector3();
		offset.addVectors(box.max, box.min);
		offset.multiplyScalar( -0.5 );

		/* 
		 * Center, but only if there are no animations as these
		 * will get messed up by the centering. Though presumably 
		 * this could be corrected by adjusting the animation 
		 * fixed point(s).
		 */
		if(Object.keys(this.animatedMesh).length == 0){
		    // Move meshes.
		    obj3d.traverse(function(child){
			child.geometry.translate(offset.x, offset.y, offset.z);
		    });
		    brigl.offset = new THREE.Vector3();
		}
		else {
		    brigl.offset = offset;
		}
		brigl.radius = box.getBoundingSphere().radius;
            }
            obj3d.position.add(brigl.offset);
            obj3d.updateMatrix();
        }
        return obj3d;
    }

};



// Abstract class for different lines in LDraw format (supported: 0,1,3,4. ignored: 2, 5 (lines))
BRIGL.BrickSpec = function() {
    // constructor
};

BRIGL.BrickSpec.prototype = {
    constructor: BRIGL.BrickSpec,
};

// Class representing lines of type 0 (comments) some BFC format is supported
BRIGL.CommentSpec = function(vals) {
    // constructor
    this.vals = vals;
};
BRIGL.CommentSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.CommentSpec.prototype = {

    constructor: BRIGL.CommentSpec,
    isCertify: function() {
        return ((this.vals.length >= 2) && (this.vals[1] === "BFC") && (this.vals[2] === "CERTIFY"));
    },
    isCertifyCcw: function() {
        if ((this.isCertify()) && (this.vals.length == 4)) {
            return this.vals[3] === "CCW";
        }
        return true;
    },
    isAnimated: function() {
        return ((this.vals.length >= 2) && (this.vals[1] === "SIMPLEANIM") && (this.vals[2] === "ANIMATED"));
    },
    animatedName: function() {
        return this.vals[3];
    },
    isInvertNext: function() {
        return ((this.vals.length >= 2) && (this.vals[1] === "BFC") && (this.vals[2] === "INVERTNEXT"));
    },
    isBfcCcw: function() {
        return ((this.vals.length == 3) && (this.vals[1] === "BFC") && (this.vals[2] === "CCW"));
    },
    isBfcCw: function() {
        return ((this.vals.length == 3) && (this.vals[1] === "BFC") && (this.vals[2] === "CW"));
    },
    isStep: function() {
        return ((this.vals.length == 2) && (this.vals[1] === "STEP"));
    },
    fillMesh: function(transform, currentColor, meshFiller) {
        // if it is an animation definition, parse and add it
        if ((this.vals.length > 3) && (this.vals[1] === "SIMPLEANIM") && (this.vals[2] === "ANIMATION")) {

            var animation = new BRIGL.Animation();
            animation.name = this.vals[3];
            animation.duration = parseInt(this.vals[4]);
            animation.state = this.vals[5];


            for (var i = 6; i < this.vals.length; i++) {
                if (this.vals[i] === 'DEF') {
                    //parse definitions
                    var defs = this.vals.slice(i + 1).join(' ');
                    // alert(defs);
                    while (true) {
                        var start = defs.indexOf('[');
                        var end = defs.indexOf(']');
                        if (start == -1) break;
                        var defstr = defs.slice(start + 1, end);
                        //alert("singledef:"+defstr);
                        defs = defs.slice(end + 2);
                        //alert("remainder: "+defs);

                        var def = new BRIGL.AnimationDef();
                        def.parse(defstr, meshFiller);
                        animation.defs.push(def);

                    }


                    i = this.vals.length; // exit loop

                } else if (this.vals[i] === 'TOGGLE') {
                    i++;
                    animation.toggle.push(this.vals[i]);
                } else if (this.vals[i] === 'CHAIN') {
                    i++;
                    animation.chain.push(this.vals[i]);
                }
            }

            meshFiller.animations[animation.name] = animation;
        }
    }
};

// this represent a part, has a list of BrickSpec inside
BRIGL.PartSpec = function(partName) {
    // constructor
    this.partName = partName;
    this.lines = [];
    this.fullyLoaded = false; // if this part is completely loaded with all children or not
    this.waiters = []; // list of callbacks to be called when this part is ready.
    this.numSteps = 1; // number of steps encountered
};
BRIGL.PartSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.PartSpec.prototype = {

    constructor: BRIGL.PartSpec,
    addLine: function(brickSpec) {
        this.lines.push(brickSpec);
        if ((brickSpec.isStep) && (brickSpec.isStep())) {
            this.numSteps++;
        }
    },
    fillMesh: function(transform, currentColor, meshFiller, stepLimit) {
        for (var i = 0; i < this.lines.length; i++) {

	    // stepLimit being defined is marker for this being called at the
	    // root level instead of at the sub-part level.
	    //
	    // Note: This will not work well if the root level only has a few
	    //       parts and most of the model is in sub parts.
	    //
	    if (typeof stepLimit != 'undefined'){
		BRIGL.log("Generating geometry " + i + "/" + this.lines.length);
	    }
	    
            var spec = this.lines[i];
            if ((spec.isStep) && (spec.isStep())) {
                stepLimit--;
                if (stepLimit == 0) return;
            }
            spec.fillMesh(transform, currentColor, meshFiller);
        }
    },
    wakeWaiters: function() {
        this.fullyLoaded = true;
        for (var i = 0; i < this.waiters.length; i++) {
            this.waiters[i]();
        }
        delete this.waiters;
    },
    whenReady: function(callback) {
        // if we are already loaded, call callback immediately
        this.fullyLoaded ? callback() : this.waiters.push(callback);
    }
};

// This class represent lines of type 1, subparts
BRIGL.SubPartSpec = function(vals, inverted, animated, animatedName) {
    // constructor
    this.color = parseInt(vals[1]);
    this.inverted = inverted;
    this.animated = animated;
    this.animatedName = animatedName;
    this.subpartName = vals.slice(14).join(" ").toLowerCase(); // join laste elements after 14^, work only if user use single space delimiter..
    this.subpartSpec = undefined;
    this.matrix = new THREE.Matrix4();
    this.matrix.set(parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]), parseFloat(vals[2]),
		    parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]), parseFloat(vals[3]),
		    parseFloat(vals[11]), parseFloat(vals[12]), parseFloat(vals[13]), parseFloat(vals[4]),
		    0.0, 0.0, 0.0, 1.0);
};
BRIGL.SubPartSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.SubPartSpec.prototype = {

    constructor: BRIGL.SubPartSpec,
    fillMesh: function(transform, currentColor, meshFiller) {
        if (this.inverted) meshFiller.inverting = !meshFiller.inverting;

        var nt = new THREE.Matrix4();
        nt.multiplyMatrices(transform, this.matrix);
        var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;

        if (this.animated) {
            //var subPartPos = nt.getPosition();
	    var subPartPos = new THREE.Vector3();
	    //subPartPos.setFromMatrixPosition(nt);
            var subPartPosNegated = subPartPos.clone().negate();
            // create a subfiller and a Mesh for this branch
            var subFiller = new BRIGL.MeshFiller();
            var opt2 = xclone(meshFiller.options); // use same options...
            opt2.dontCenter = true; // ...except don't center
            opt2.startColor = c; // use current color as starting color

            var subMesh = subFiller.partToMesh(this.subpartSpec, opt2, false); // create submesh
            subMesh.applyMatrix(nt);
            // since i'm using quats, i have to bring rotation separately
            subMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(nt));
            //subMesh.updateMatrix();
            meshFiller.animatedMesh[this.animatedName] = subMesh; // add submesh to parent filler
            // also add all submesh animatedMesh (so the first one has all the mappings)
            Object.keys(subFiller.animatedMesh).map(function(key) {
                meshFiller.animatedMesh[key] = subFiller.animatedMesh[key];
            });
            // same for animations
            Object.keys(subFiller.animations).map(function(key) {
                meshFiller.animations[key] = subFiller.animations[key];
            });

        } else {
            this.subpartSpec.fillMesh(nt, c, meshFiller);
        }

        if (this.inverted) meshFiller.inverting = !meshFiller.inverting;
    }
};

// This class represent lines of type 2, lines
BRIGL.LineSpec = function(vals) {
    // constructor
    this.color = parseInt(vals[1]);
    this.one = new THREE.Vector3(parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]));
    this.two = new THREE.Vector3(parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]));
};
BRIGL.LineSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.LineSpec.prototype.constructor = BRIGL.LineSpec;
BRIGL.LineSpec.prototype.fillMesh = function(transform, currentColor, meshFiller) {
    if (!meshFiller.wantsLines) return; // not interested
    var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
    meshFiller.addLine(this.one.clone().applyMatrix4(transform), this.two.clone().applyMatrix4(transform), c);
};

// This class represent lines of type 5, conditional lines
BRIGL.CondLineSpec = function(vals) {
    // constructor
    this.color = parseInt(vals[1]);
    this.one = new THREE.Vector3(parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]));
    this.two = new THREE.Vector3(parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]));
};
BRIGL.CondLineSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.CondLineSpec.prototype.constructor = BRIGL.CondLineSpec;
BRIGL.CondLineSpec.prototype.fillMesh = function(transform, currentColor, meshFiller) {
    var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
    meshFiller.addCondLine(this.one.clone().applyMatrix4(transform), this.two.clone().applyMatrix4(transform));
};

// This class represent lines of type 3, triangles
BRIGL.TriangleSpec = function(vals, ccw, certified) {
    // constructor
    this.ccw = ccw;
    this.certified = certified;
    this.color = parseInt(vals[1]);
    this.one = new THREE.Vector3(parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]));
    this.two = new THREE.Vector3(parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]));
    this.three = new THREE.Vector3(parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]));
};
BRIGL.TriangleSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.TriangleSpec.prototype.constructor = BRIGL.TriangleSpec;
BRIGL.TriangleSpec.prototype.fillMesh = function(transform, currentColor, meshFiller) {

    var det = transform.determinant(); // this is equal for all tri and quad in PartSpec, could be calculated before
    var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
    meshFiller.addFace(this.ccw, this.certified, det, c,
		       this.one.clone().applyMatrix4(transform),
		       this.two.clone().applyMatrix4(transform),
		       this.three.clone().applyMatrix4(transform));
};

// This class represent lines of type 4, quads
BRIGL.QuadSpec = function(vals, ccw, certified) {
    // constructor
    this.ccw = ccw;
    this.certified = certified;
    this.color = parseInt(vals[1]);
    this.one = new THREE.Vector3(parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]));
    this.two = new THREE.Vector3(parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]));
    this.three = new THREE.Vector3(parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]));
    this.four = new THREE.Vector3(parseFloat(vals[11]), parseFloat(vals[12]), parseFloat(vals[13]));
};
BRIGL.QuadSpec.prototype = Object.create(BRIGL.BrickSpec.prototype);
BRIGL.QuadSpec.prototype.constructor = BRIGL.QuadSpec;
BRIGL.QuadSpec.prototype.fillMesh = function(transform, currentColor, meshFiller) {
    //BRIGL.log("fillMesh for quad");
    var det = transform.determinant();
    var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
    meshFiller.addFace(this.ccw, this.certified, det, c,
		       this.one.clone().applyMatrix4(transform),
		       this.two.clone().applyMatrix4(transform),
		       this.three.clone().applyMatrix4(transform),
		       this.four.clone().applyMatrix4(transform));
};

// This object handles the actual fetching of the part from the server. It
// can use either jQuery or Ajax to handle the request. It also handles
// checking multiple locations for a part so that the standard LDraw directory
// layout can be used.
//
BRIGL.PartFetcher = function(partsUrls, partName, successCallback, errorCallback){
    this.errorCallback = errorCallback;
    this.errorMsg = "";
    this.partName = partName;
    this.partsUrls = partsUrls;
    this.successCallback = successCallback;
    this.urlIndex = 0;
}

BRIGL.PartFetcher.prototype = {
    constructor : BRIGL.PartFetcher,

    useAjax : function () {
	if (this.urlIndex == this.partsUrls.length){
	    this.errorCallback("Could not load " + this.partName + " '" + this.errorMsg + "'");
	}
	else{
	    var purl = this.sanitizeUrl(this.partsUrls[this.urlIndex] + this.partName);
            new Ajax.Request(purl, {
                method: 'get',
                onSuccess: (function(transport) {
		    this.successCallback(transport.responseText);
                }).bind(this),
                onFailure: (function(a) {
		    //this.errorMsg = a.status + " - " + a.responseText;
		    this.errorMsg = a.status;
		    this.urlIndex++;
		    this.useAjax();
                }).bind(this)
            });
	}
    },
    
    useJQuery : function () {
	if (this.urlIndex == this.partsUrls.length){
	    this.errorCallback("Could not load " + this.partName + " '" + this.errorMsg + "'");
	}
	else{
	    var purl = this.sanitizeUrl(this.partsUrls[this.urlIndex] + this.partName);
            jQuery.ajax({
		url: purl,
		type: "get",
		dataType: "text",
		error: (function(a) {
		    //this.errorMsg = a.status + " - " + a.responseText;
		    this.errorMsg = a.status;
		    this.urlIndex++;
		    this.useJQuery();
		}).bind(this),
		success: (function(strdata) {
                    this.successCallback(strdata);
		}).bind(this)
            });
	}
    },
    
    sanitizeUrl : function(purl){
	return purl.replace(/\\/gi, "/");
    }
}

BRIGL.Builder = function(partsUrls, options) {
    // constructor
    if (!options) options = {};
    this.partCache = {};
    this.partRequests = {};
    if (partsUrls instanceof Array){
	this.partsUrls = partsUrls;
    }
    else {
	this.partsUrls = [partsUrls];
    }
    this.asyncnum = 0;
    this.options = options;
};

BRIGL.Builder.prototype = {

    constructor: BRIGL.Builder,

    cleanCache: function() {
        this.partCache = {};
    },

    cacheCount: function() {
        return Object.keys(this.partCache).length;
    },

    asyncReq: function(partName, callback) {
        if (this.options.forceLowercase) {
            partName = partName.toLowerCase();
        }
        if (!this.options.dontUseSubfolders) {
	    // replicate first char to subdivide in more folders
	    partName = partName.charAt(0) + "/" + partName; 
        }

	var fetcher = new BRIGL.PartFetcher(this.partsUrls, partName, callback, this.errorCallback);
	if (this.options.ajaxMethod == "jquery") {
	    fetcher.useJQuery();
	}
	else{
	    fetcher.useAjax();
	}	
    },

    asyncReqUrl: function(url, callback) {
	var fetcher = new BRIGL.PartFetcher([""], url, callback, this.errorCallback);
	if (this.options.ajaxMethod == "jquery") {
	    fetcher.useJQuery();
	}
	else{
	    fetcher.useAjax();
	}	
    },

    // Loads a model from the part server and return the Mesh
    loadModelByName: function(partName, options, callback, errorCallback) {
        BRIGL.log("Creating " + partName + "...");
        this.errorCallback = errorCallback;
        if (!options) options = {};
        var partSpec = this.getPart(partName);
        partSpec.whenReady((function() {
            BRIGL.log("Generating geometry");
            var meshFiller = new BRIGL.MeshFiller();
            var mesh;
            try {
                mesh = meshFiller.partToMesh(partSpec, options, true);
            } catch (e) {
                errorCallback("Error in partToMesh " + e);
                return;
            }
            BRIGL.log("Model loaded successfully");
            callback(mesh);

        }).bind(this));
    },

    // Loads a model from the data provided and return the Mesh
    loadModelByData: function(partName, partData, options, callback, errorCallback) {
        BRIGL.log("Parsing " + partName + "...");
        partName = partName.toLowerCase();
        this.errorCallback = errorCallback;
        var partSpec = new BRIGL.PartSpec(partName);
        this.partCache[partSpec.partName] = partSpec;
        this.parsePart(partSpec, partData);

        partSpec.whenReady((function() {
            this.loadModelByName(partName, options, callback, errorCallback);
        }).bind(this));
    },

    // Loads a model from an url. It must be on the same server or the server/browser must allow crossorigin fetch
    loadModelByUrl: function(purl, options, callback, errorCallback) {
        this.errorCallback = errorCallback;
        BRIGL.log("Parsing " + purl + "...");

        this.asyncReqUrl(purl, (function(docContent) {
                BRIGL.log("File downloaded.");
                this.loadModelByData("UrlLoaded.ldr", docContent, options, callback, errorCallback);
            }).bind(this)

        );
    },

    parsePart: function(partSpec, partData) {
        // parses some text and fill the PartSpec in input
        var lines = partData.split("\n");
        if (this.isMultipart(lines)) {
            this.parseMultiPart(partSpec, lines);
        } else {
            this.parseSinglePart(partSpec, lines);
        }
    },

    parseSinglePart: function(partSpec, lines) {
        // parses some text and build a PartSpec fully populated with BrickSpec children

        var inverted = false; // next should be inverted?
        var animated = false; // next should be animated?
        var animatedName = undefined; //valid only if animated
        var ccw = true; // dealing with ccw or cw ?
        var certified = false; // certified BFC ?

        for (var i = 0; i < lines.length; i++) {
            var li = lines[i].trim();
            if (li === '') continue;

            var tokens = li.split(/[ \t]+/);
            if (tokens[0] === '0') {
                var cs = new BRIGL.CommentSpec(tokens);
                partSpec.addLine(cs);
                if (cs.isInvertNext()) {
                    inverted = true;
                } else if (cs.isCertify()) {
                    certified = true;
                    ccw = cs.isCertifyCcw();
                } else if (cs.isBfcCcw()) {
                    ccw = true;
                } else if (cs.isAnimated()) {
                    animated = true;
                    animatedName = cs.animatedName();
                } else if (cs.isBfcCw()) {
                    ccw = false;
                }
            } else if (tokens[0] === '1') {
                partSpec.addLine(new BRIGL.SubPartSpec(tokens, inverted, animated, animatedName));
                inverted = false;
                animated = false;
                animatedName = undefined;
            } else if (tokens[0] === '2') {
                partSpec.addLine(new BRIGL.LineSpec(tokens));
            } else if (tokens[0] === '3') {
                partSpec.addLine(new BRIGL.TriangleSpec(tokens, ccw, certified));
            } else if (tokens[0] === '4') {
                partSpec.addLine(new BRIGL.QuadSpec(tokens, ccw, certified));
            } else if (tokens[0] === '5') {
                partSpec.addLine(new BRIGL.CondLineSpec(tokens));
            }
        }
        this.populateSubparts(partSpec);
    },

    parseMultiPart: function(part, lines) {
        // parses some text and build a PartSpec fully populated with BrickSpec children
        BRIGL.log("Parsing multipart " + part.partName);

        var currentName = "";
        var stuff = [];
        var currentStuff = null;

        // first we parse all part block into a buffer..
        for (var i = 0; i < lines.length; i++) {
            var li = lines[i].trim();
            if (li === '') continue;

            if (li.startsWith("0 FILE ")) {
                if (currentStuff) {
                    // if we were already scanning a part, store it before starting the new one
                    stuff.push(currentStuff);
                }
                var subname = li.substring(7).toLowerCase();
                BRIGL.log("Found subpart " + subname);

                // already create and cache the partSpec so we can reference it early to load unordered multipart models
                var subPartSpec = new BRIGL.PartSpec(subname);
                this.partCache[subname] = subPartSpec;

                currentStuff = {
                    partName: subname,
                    lines: [],
                    partSpec: subPartSpec
                };
            } else {
                if (currentStuff) currentStuff.lines.push(li);
            }
        }
        if (currentStuff) {
            // handle it
            stuff.push(currentStuff);
        }
        BRIGL.log("Total subparts: " + stuff.length);

        // scroll backward becouse first parts depend on last parts
        for (var i = stuff.length - 1; i >= 0; i--) {
            var last = stuff[i];
            var partSpec;
            if (i == 0) {
                // as this is the first and main part, use partSpec received in input
                partSpec = part;
            } else {
                // this is a subpart, use the partSpec we created early
                partSpec = last.partSpec; // new BRIGL.PartSpec(last.partName.toLowerCase());
                // this.partCache[partSpec.partName] = partSpec;
            }
            this.parseSinglePart(partSpec, last.lines);
        }
    },

    // tests if an array of lines is a multipart
    isMultipart: function(lines) {
        for (var i = 0; i < lines.length; i++) {
            var li = lines[i].trim();
            if (li === '') continue;

            if (li.startsWith("0 FILE ")) {
                return true;
            } else if (li.startsWith("1") || li.startsWith("2") || li.startsWith("3") || li.startsWith("4") || li.startsWith("5")) {
                // as per specifications, any command before a 0 FILE means no multipart
                return false;
            }
        }
        return false;
    },

    getPart: function(partName) {
        // obtain a PartSpec, either from local cache or from server
        var p = this.partCache[partName];
        if (p) {
            return p;
        } else {
            var p = new BRIGL.PartSpec(partName);
            this.partCache[partName] = p;

            // the part is not being downloaded, we'll start it!
            BRIGL.log("Loading " + partName);
            this.asyncReq(partName, (function(txt) {
                // when async return, parse part
                this.parsePart(p, txt);
            }).bind(this));

            return p;
        }
    },

    populateSubparts: function(partSpec) {
        // takes a PartSpec and scan for all SubpartSpec (type 1)
        // for each one it loads the correct PartSpec (we loaded only the name before)
        var toLoad = [];
        for (var i = 0; i < partSpec.lines.length; i++) {
            var spec = partSpec.lines[i];
            if (spec instanceof BRIGL.SubPartSpec) {
                if (spec.subpartSpec === undefined) {
                    toLoad.push(spec);
                }
            }
        }
        // now toLoad contains all the subpart that need loading.
        var count = toLoad.length;
        if (count == 0) {
            // no subpart to load, we are ready!
            partSpec.wakeWaiters();
        } else {
            for (var i = 0; i < toLoad.length; i++) {
                var spec = toLoad[i];
                var subSpec = this.getPart(spec.subpartName);
                spec.subpartSpec = subSpec;

                // all subpart must be ready before we call the callback
                subSpec.whenReady(function() {
                    count--; // decrease total amount of parts we are waiting for
                    if (count == 0) {
                        // now all subparts are in place, wake up all "process" waiting for this part to be fully loaded
                        partSpec.wakeWaiters();
                    }
                });
            }
        }
    }
};


// create a minimal working container for Three.js.
// This is not necessary, you can use Mesh returned by Builder with your
// Three.js setup.
BRIGL.BriglContainer = function(container, model, options) {
    // constructor
    this.scene = 0;
    this.camera = 0;
    this.renderer = 0;
    this.container = container;
    this.mouseDown = 0;
    this.lastMouseX = null;
    this.lastMouseY = null;
    this.touches = null;
    this.number_touches = 0;
    
    this.latlon = (options && options.latlon);
    this.mesh_matrix = null;
    this.lat_angle = 0;
    this.lon_angle = 0;
    
    this.setup(options ? options : {
        antialias: true
    });
    if (model){
	this.setModel(model, true);
	this.render();
    }
};

BRIGL.BriglContainer.prototype = {

    constructor: BRIGL.BriglContainer,

    degToRad: function(degrees) {
        return degrees * Math.PI / 180;
    },
    
    setModel: function(newmesh, resetView) {
	
        var oldMesh = this.mesh;
        this.mesh = newmesh;
        if (resetView) {
            if (!this.latlon){
                newmesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, -0.5).normalize(), 3.34);

                // place the camera at a right distance to gracefully fill the area
                var radiusDelta = newmesh.brigl.radius / 180.0; // empirical	    
                this.camera.position.set(0 * radiusDelta, 150 * radiusDelta, 400 * radiusDelta);
                this.camera.lookAt(this.scene.position);
	    }
            else{
                this.mesh_matrix = new THREE.Matrix4();
                this.mesh_matrix.makeRotationZ(Math.PI);
                this.lat_angle = this.degToRad(30);
                this.lon_angle = this.degToRad(30);
                this.latLonRotate();

                // place the camera at a right distance to gracefully fill the area
                var radiusDelta = newmesh.brigl.radius / 180.0; // empirical	    
                this.camera.position.set(0 * radiusDelta, 0 * radiusDelta, 500 * radiusDelta);
                this.camera.lookAt(this.scene.position);
            }            

        } else {
            if (oldMesh) {
                if (!this.latlon){
                    newmesh.position.copy(oldMesh.position);
                    newmesh.quaternion.copy(oldMesh.quaternion);
                }
                else {
                    this.mesh_matrix = new THREE.Matrix4();
                    this.latLonRotate();
                }
            }
        }
        this.scene.add(this.mesh);

	if (0){
	    var sphere = new THREE.Mesh(new THREE.SphereGeometry( this.mesh.brigl.radius, 16, 16),		
					new THREE.MeshPhongMaterial( { color: 0xff0000,transparent: true, opacity: 0.3} )
				       );
	    this.scene.add(sphere);
	}

        if (oldMesh) this.scene.remove(oldMesh);

        this.render();
    },


    handleMouseDown: function(event) {

        event.preventDefault();
        event.stopPropagation();

        this.mouseDown = event.button + 1;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    },

    handleMouseUp: function(event) {
        event.preventDefault();
        event.stopPropagation();
        this.mouseDown = 0;
    },
    
    handleMouseWheel: function(event) {
        event.preventDefault();
        event.stopPropagation();
        var delta = event.wheelDelta ? event.wheelDelta : (event.detail ? -event.detail : 0);
        var mu = (delta < 0 ? 1.1 : delta > 0 ? 0.9 : 1);
        this.camera.position.multiplyScalar(mu);

        this.render();
    },

    handleMouseMove: function(event) {
        if (this.mouseDown == 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        var newX = event.clientX;
        var newY = event.clientY;

        var deltaX = newX - this.lastMouseX;
        var deltaY = newY - this.lastMouseY;

        if (this.mouseDown == 1) {

            // Rotation using quaternions.            
            if (!this.latlon){

                var q2 = new THREE.Quaternion();
                q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.degToRad(deltaY / 5));
                var q = new THREE.Quaternion();
                q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.degToRad(deltaX / 5));

                this.mesh.quaternion.multiplyQuaternions(q, this.mesh.quaternion);
                this.mesh.quaternion.multiplyQuaternions(q2, this.mesh.quaternion);
                this.mesh.updateMatrix();
            }
            // Rotation using rotation matrices (latitude / longitude rotation).
            else {
                this.lat_angle += this.degToRad(deltaY / 5);
                if (this.lat_angle > 0.5 * Math.PI){
                    this.lat_angle = 0.5 * Math.PI;
                }
                else if (this.lat_angle < -0.5 * Math.PI){
                    this.lat_angle = -0.5 * Math.PI;
                }
                this.lon_angle += this.degToRad(deltaX / 5);
                this.latLonRotate();
            }
        } else if (this.mouseDown == 2) {
            // pan
            this.mesh.position.add(new THREE.Vector3(deltaX / 5.0, -deltaY / 5.0));
            this.mesh.updateMatrix();
        }

        this.lastMouseX = newX;
        this.lastMouseY = newY;

        this.render();
    },

    handleTouchEnd: function(event) {
        event.preventDefault();
        event.stopPropagation();
        this.number_touches = 0;
    },

    handleTouchMove: function(event) {
        if (this.number_touches == 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();

	// 1 touch is rotation.
        if (this.number_touches == 1) {
	    var deltaX = event.touches[0].pageX - this.touches[0];
	    var deltaY = event.touches[0].pageY - this.touches[1];

            if (!this.latlon){
                var q2 = new THREE.Quaternion();
                q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.degToRad(deltaY / 5));
                var q = new THREE.Quaternion();
                q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.degToRad(deltaX / 5));

                this.mesh.quaternion.multiplyQuaternions(q, this.mesh.quaternion);
                this.mesh.quaternion.multiplyQuaternions(q2, this.mesh.quaternion);
                this.mesh.updateMatrix();
            }
            else{
                this.lat_angle += this.degToRad(deltaY / 5);
                if (this.lat_angle > 0.5 * Math.PI){
                    this.lat_angle = 0.5 * Math.PI;
                }
                else if (this.lat_angle < -0.5 * Math.PI){
                    this.lat_angle = -0.5 * Math.PI;
                }
                this.lon_angle += this.degToRad(deltaX / 5);
                this.latLonRotate();
            }
        }
	
	// 2 touches are panning and scaling.
	else if (this.number_touches == 2) {
	    // pan.
	    var delta1 = new THREE.Vector3(event.touches[0].pageX - this.touches[0],
					   event.touches[0].pageY - this.touches[1]);
	    var delta2 = new THREE.Vector3(event.touches[1].pageX - this.touches[2],
					   event.touches[1].pageY - this.touches[3]);

	    var pan = new THREE.Vector3();
	    pan.addVectors(delta1, delta2);
	    pan.multiplyScalar(0.2);
	    pan.y = -1.0 * pan.y;
            this.mesh.position.add(pan);

	    // resize.
	    var delta1 = new THREE.Vector3(this.touches[0] - this.touches[2],
					   this.touches[1] - this.touches[3]);
	    var delta2 = new THREE.Vector3(event.touches[0].pageX - event.touches[1].pageX,
					   event.touches[0].pageY - event.touches[1].pageY);

	    var scale = delta1.length()/delta2.length();
            this.camera.position.multiplyScalar(scale);
	    
            this.mesh.updateMatrix();
        }

	this.touches = [];
	for (var i = 0; i < this.number_touches; i++){
	    this.touches.push(event.touches[i].pageX);
	    this.touches.push(event.touches[i].pageY);
	}

        this.render();
    },

    handleTouchStart: function(event) {
        event.preventDefault();
        event.stopPropagation();

	this.touches = [];
        this.number_touches = event.touches.length;
	for (var i = 0; i < this.number_touches; i++){
	    this.touches.push(event.touches[i].pageX);
	    this.touches.push(event.touches[i].pageY);
	}
    },

    latLonRotate: function(){
        var m1 = new THREE.Matrix4();
        m1.makeRotationY(this.lon_angle);

        var m2 = new THREE.Matrix4();
        m2.makeRotationX(this.lat_angle);

        this.mesh.matrix.copy(this.mesh_matrix);
        this.mesh.applyMatrix(m1);
        this.mesh.applyMatrix(m2);
    },
    
    setup: function(options) {
        // SCENE
        this.scene = new THREE.Scene();

        // Check for prototype.js functionality.
        if (typeof Element.Layout != 'undefined'){
            
            // Use prototype.js to query for the container size.
            var layout = new Element.Layout(this.container)
        
	    // CAMERA
            var SCREEN_WIDTH = layout.get('width'),
                SCREEN_HEIGHT = layout.get('height');
        }
        else{
            var SCREEN_WIDTH = this.container.scrollWidth,
                SCREEN_HEIGHT = this.container.scrollHeight;
        }
        
        var VIEW_ANGLE = 45,
            ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT,
            NEAR = 0.1,
            FAR = 20000;

	// Warning the user if the container is really small.
	if ((SCREEN_WIDTH < 20) || (SCREEN_HEIGHT < 20)){
	    var msg = "Warning! Rendering container is very small!";
	    BRIGL.log(msg);
	    console.log(msg);
	}
	
        this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);

	
        this.scene.add(this.camera);
        this.camera.position.set(0, 150, 400);
        this.camera.lookAt(this.scene.position);
        // RENDERER
        this.renderer = new THREE.WebGLRenderer(options);
        this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
	this.renderer.setClearColor((options.backgroundColor ? options.backgroundColor : 0xffffff), 1 );
        this.container.appendChild(this.renderer.domElement);

        // LIGHT (lighting could be choosen better)
        var light = new THREE.PointLight((options.pointLightColor ? options.pointLightColor : 0xffffff));
        light.position.set(0, 250, 0);
        this.scene.add(light);

        var light = new THREE.DirectionalLight((options.directionalLightColor ? options.directionalLightColor : 0xaaaaaa));
        light.position.set(0, 0, 100);
        this.scene.add(light);

        // Mouse events.
        this.container.addEventListener('mousedown', (function(event) {
            this.handleMouseDown(event);
        }).bind(this), false);
        this.container.addEventListener('mouseup', (function(event) {
            this.handleMouseUp(event);
        }).bind(this), false);
        this.container.addEventListener('mousemove', (function(event) {
            this.handleMouseMove(event);
        }).bind(this), false);
        this.container.addEventListener('mousewheel', (function(event) {
            this.handleMouseWheel(event);
        }).bind(this), false);
        this.container.addEventListener('DOMMouseScroll', (function(event) {
            this.handleMouseWheel(event);
        }).bind(this), false); // firefox

	// Touch events.
        this.container.addEventListener('touchstart', (function(event) {
            this.handleTouchStart(event);
        }).bind(this), false);
        this.container.addEventListener('touchend', (function(event) {
            this.handleTouchEnd(event);
        }).bind(this), false);
        this.container.addEventListener('touchmove', (function(event) {
            this.handleTouchMove(event);
        }).bind(this), false);	
	
    },

    render: function() {
        this.renderer.render(this.scene, this.camera);
    }
};
