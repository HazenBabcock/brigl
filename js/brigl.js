/*

    BRIGL - A library to parse and render LDraw models with WEBGL.

    Copyright (C) 2012  Nicola MSX Lugato

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

		Revision 4:
		- Colored lines
		- First test for animations
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
		- the submodel restart with 16 color (see PartToMesh). use option to continue with last color in parent model
		- model centering broken with animations, redo from start
		
*/
var BRIGL = BRIGL || { REVISION: '3' };

BRIGL.log = function(msg)
{
	console.info(msg);
}

if (typeof String.prototype.trim != 'function') {
  String.prototype.trim = function (){
    return this.replace( /^\s+|\s+$/g, '' );
  };
}
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}
  function xclone(xxx) {
   var target = {};
   Object.keys( xxx ).map(function( kkk ) {
   	target[kkk] = xxx[kkk];
   });
   return target;
  };
BRIGL.AnimationDef = function()
{
		this.type = ""; // ROTATE, TRANSLATE (maybe SCALE?)
		this.mesh = undefined; 		// mesh to be animated
		this.vector = undefined;	// axis for rotation or delta for translation
		this.scalar = 0.0; 				// angle for rotations, or unused
		this.interpolator = undefined; // interpolation function, see http://sole.github.com/tween.js/examples/03_graphs.html
		
};  
BRIGL.AnimationDef.prototype = {
	constructor: BRIGL.AnimationDef,
	
	getFunction: function()
	{
			if(this.type==='ROTATE')
			{
					var qStart = new THREE.Quaternion();
					qStart.copy(this.mesh.quaternion);
					
					
					return (function (value) {
							var qMult = new THREE.Quaternion();
							qMult.setFromAxisAngle(this.vector, this.interpolator( value ) * this.scalar);
							this.mesh.quaternion.multiply(qStart, qMult);
							
							// cont.render();
				
					}).bind(this) ; 				
			}
			else if(this.type === 'TRANSLATE')
			{
					var vStart = new THREE.Vector3();
					vStart.copy(this.mesh.position);
					
					
					return (function (value) {
							var vDelta = new THREE.Vector();
							vDelta.copy(this.vector);
							vDelta.multiplyScalar( this.interpolator( value ));
							
							this.mesh.position.add(vStart, vDelta);
							this.mesh.updateMatrix();
				
					}).bind(this) ; 				
				
			}
	}
}  
BRIGL.Animation = function()
{
		this.name = ""; // name of animation
		this.duration = 0;  // milliseconds
		this.state = "ENABLED"; // enabled, disabled, visible
		this.defs = [];  // definitions
};  
BRIGL.Animation.prototype = {
	constructor: BRIGL.Animation,
	start:function(container)
	{
			var position = { v: 0.0 };
			var target =   { v: 1.0 };
			var funcs = this.defs.map(function(de){return de.getFunction()});	
			
			this.tween = new TWEEN.Tween(position).to(target, this.duration);
			this.tween.onUpdate( (function () {
						for (var i=0; i<funcs.length; i++)
						{
							funcs[i](position.v);
						}
						container.render();
			
				}).bind(this) ); 
			this.tween.easing(TWEEN.Easing.Linear.None); // here i use linear, AnimationDefs will translate with their interpolator
			this.tween.start();
	},
	update: function()
	{
			return this.tween.update();
	}
	
}
// an object used to build up the geometry when we have all pieces
BRIGL.MeshFiller = function ( ) {
	// constructor
	this.verticesMap = {}; // vertices hashmap, for fast access. We store the index of verticeArray
	this.verticesArray = []; // for indexing.
	this.faces = [];
	this.lines = {}; // dictionary color:array, contain vertices for line geometry, separated by color
	this.edgeMap = {};	//used to calculate smoothing with conditional lines
	this.wantsLines = false; // are we interested in reading lines (type2) informations?
	this.blackLines = false; // lines all black ?
	this.inverting = false; // are we currently inverting? (BFC INVERTNEXT)
	this.precisionPoints = 4; // number of decimal points, eg. 4 for epsilon of 0.0001
	this.precision = Math.pow( 10, this.precisionPoints );
	this.animatedMesh = {}; // contains a map name:Mesh with animable subparts
	this.options = undefined; // store options
};
BRIGL.MeshFiller.prototype = {
	constructor: BRIGL.MeshFiller,
	edgeMapKey: function(idx1, idx2) {return Math.min(idx1,idx2)+":"+Math.max(idx1, idx2)},
	addVertice: function(v)
	{
			// add a vertice to the geometry returning the index in the array. If a vertex close enought exists, that one is returned and no vertices are added
			var key = [ Math.round( v.x * this.precision ), Math.round( v.y * this.precision ), Math.round( v.z * this.precision ) ].join( '_' );
			var res = this.verticesMap[ key ];
			if ( res === undefined ) {
				// new vertice
				res = this.verticesArray.length;
				this.verticesMap[ key ] = res; // store index for vertice V (since is new will be bottom of array)
				this.verticesArray.push(v);
			}
			return res;
	},
	
	addFace:function(ccw, certified, det, color, v0, v1, v2, v3)
	{
			if(!certified)
			{
					// supertrick to create 1 or 2 additional inverted faces if not certified, this problably breaks the smoothing algorithm.
					this.addFace(false, true, det, color, v2, v1, v0, v3);
					ccw = true;
			}
			var isQuad = (v3 !== undefined);
			// decide if the face should be flipped. Flipping is cumulative,
			// is done if we are inverting geometry (INVERTNEXT), the matrix determinant is negative (ie mirroring)
			// or the face is defined CW.
			var flip = this.inverting ^ (det<0.0) ^ (!ccw); // kungfu
									
			var idx1 = this.addVertice(flip?v2:v0);
			var idx2 = this.addVertice(v1);
			var idx3 = this.addVertice(flip?v0:v2);
			var idx4;
			var fa;
			if(isQuad)
			{
					idx4 = this.addVertice(v3);
					fa = new THREE.Face4(idx1,idx2,idx3,idx4);
			}
			else
			{
					fa =  new THREE.Face3(idx1, idx2, idx3);
			}
			fa.materialIndex = BRIGL_MATERIALS_MAPPING[color];
			this.faces.push(fa);
						
	},
	addLine:function(v1, v2, color)
	{
		if(this.blackLines) color = 0; // if wants all black, just use always 0 as color
		var arr = this.lines[color];
		if(!arr) { arr = []; this.lines[color] = arr; }
		arr.push(v1);
		arr.push(v2);
	},
	addCondLine:function(v1, v2)
	{
		//this.lines.push(v1.clone());
		//this.lines.push(v2.clone());
		
		var idx1 = this.addVertice(v1);
		var idx2 = this.addVertice(v2);
		var key = this.edgeMapKey(idx1,idx2);
		this.edgeMap[key] = []; // add empy array, later this will be filled by faces sharing this edge
		
	},
	smooth:function(geometrySolid)
	{
				for (var i=0; i<geometrySolid.faces.length; i++)
				{
					var f = geometrySolid.faces[i];
					var isQuad = f instanceof THREE.Face4;
					
					
					if ( isQuad ) {
						// set all vertex normal equals to face normal
						f.vertexNormals=[f.normal.clone(),f.normal.clone(),f.normal.clone(),f.normal.clone()];
						// calculate keys of the four edges
						var kab = this.edgeMapKey(f.a,f.b);
						var kbc = this.edgeMapKey(f.c,f.b);
						var kcd = this.edgeMapKey(f.d,f.c);
						var kda = this.edgeMapKey(f.d,f.a);
						// see if one of the four edges of this face is a cond line
						// if it is, we save the face and the index of the two vertices of the edge for later processing
						var x;
						x = this.edgeMap[kab]; if(x) x.push([f, 0,1]);
						x = this.edgeMap[kbc]; if(x) x.push([f, 1,2]);
						x = this.edgeMap[kcd]; if(x) x.push([f, 2,3]);
						x = this.edgeMap[kda]; if(x) x.push([f, 3,0]);
					}
					else
					{
						// set all vertex normal equals to face normal
						f.vertexNormals=[f.normal.clone(),f.normal.clone(),f.normal.clone()];
						// calculate keys of the three edges
						var kab = this.edgeMapKey(f.a,f.b);
						var kbc = this.edgeMapKey(f.c,f.b);
						var kca = this.edgeMapKey(f.a,f.c);
						// see if one of the three edges of this face is a cond line
						// if it is, we save the face and the index of the two vertices of the edge for later processing
						var x;
						x = this.edgeMap[kab]; if(x) x.push([f, 0,1]);
						x = this.edgeMap[kbc]; if(x) x.push([f, 1,2]);
						x = this.edgeMap[kca]; if(x) x.push([f, 2,0]);
					}
	
				}
				
				// now we cycle all edges found (each containing all array of affected faces)
				Object.keys( this.edgeMap ).map((function( key ) {
					var facesver = this.edgeMap[ key ] ;
					if(facesver.length>=2) // we really handle only case with exacly two faces.
					{
						// these are our arrays with face, and two index for vertexNormals
						var obj1 = facesver[0];
						var obj2 = facesver[1];
						
						// for the two vertices in the face A, add normals of face B
						obj1[0].vertexNormals[obj1[1]].addSelf(obj2[0].normal);
						obj1[0].vertexNormals[obj1[2]].addSelf(obj2[0].normal);
						
						// for the two vertices in the face B, add normals of face A
						obj2[0].vertexNormals[obj2[1]].addSelf(obj1[0].normal);
						obj2[0].vertexNormals[obj2[2]].addSelf(obj1[0].normal);
					}
					
				}).bind(this));
				for (var i=0; i<geometrySolid.faces.length; i++)
				{
					var f = geometrySolid.faces[i];
					
					f.vertexNormals.forEach(function (v){v.normalize();});
				}
	},
	buildLineGeometry: function(lineVertices, material, offset, dontCenter)
	{
		var geometryLines = new THREE.Geometry();
		geometryLines.vertices = lineVertices;
		// apply the same offset to geometryLines, thanks Three.js for returning it :P
		if(!dontCenter)geometryLines.vertices.forEach(function(v){v.addSelf(offset);});
	
		// var lineMat = new THREE.LineBasicMaterial({linewidth:3.0, color : 0x000000});
		var obj3dLines = new THREE.Line( geometryLines, material, THREE.LinePieces );
		return obj3dLines;
	},
	partToMesh: function(partSpec, options)
	{
			this.options = options;
			var drawLines = options.drawLines ? options.drawLines : false;
			var stepLimit = options.stepLimit ? options.stepLimit : -1;
			var dontCenter = options.dontCenter ? options.dontCenter : false;
			var centerOffset = options.centerOffset ? options.centerOffset : undefined;
			var dontSmooth = options.dontSmooth ? options.dontSmooth : undefined;
			var blackLines = options.blackLines ? options.blackLines : false;
			
			var geometrySolid = new THREE.Geometry();
			
			var transform = options.startingMatrix ? options.startingMatrix : new THREE.Matrix4();
			
			this.wantsLines = drawLines;
			this.blackLines = blackLines;
					
			partSpec.fillMesh(transform, 16, this, stepLimit);

			geometrySolid.vertices = this.verticesArray;
			geometrySolid.faces = this.faces;
			
			// CENTERING
			var offset = new THREE.Vector3(0,0,0);
			if (!dontCenter)
			{
				if(centerOffset)
				{
					// center around supplied offset
					offset = centerOffset;
					geometrySolid.vertices.forEach(function(v){v.addSelf(offset);});
				}
				else
				{
					offset = THREE.GeometryUtils.center(geometrySolid);
				}
			}
			
			geometrySolid.computeFaceNormals();
			
			// SMOOTHING
			if(!dontSmooth) {
				this.smooth(geometrySolid);
			}
			
			var mat = new THREE.MeshFaceMaterial(BRIGL_MATERIALS());  
			var obj3d = new THREE.Mesh( geometrySolid, mat );
			obj3d.useQuaternion = true;
			//obj3d.quaternion = new THREE.Quaternion();
			if(drawLines){
				if(this.blackLines)
				{
					var obj3dLines = this.buildLineGeometry(this.lines[0], new THREE.LineBasicMaterial({linewidth:3.0, color : 0x000000}), offset, dontCenter);
					obj3d.add(obj3dLines);
				}
				else
				{
					var materials = BRIGL_MATERIALS_EDGES();
					Object.keys( this.lines ).map((function( colKey ) {
							var material = materials[BRIGL_MATERIALS_MAPPING[colKey]];
							var obj3dLines = this.buildLineGeometry(this.lines[colKey], material, offset, dontCenter);
							obj3d.add(obj3dLines);
						
					}).bind(this));
				}
			}
			
			//add submesh for animations
			Object.keys( this.animatedMesh ).map((function( key ) {
				if(!this.animatedMesh[key].parent) // as this contains all submodels (also subsubmodels), i check first if they aren't already added
				{
					obj3d.add(this.animatedMesh[key]);
				}
			}).bind(this));
			
			// add some data to remember it.
			var brigl = {
					part: partSpec,
					offset: offset,
					animatedMesh: this.animatedMesh
			};
			
			obj3d.brigl = brigl;
			
			return obj3d;
	}

};



// Abstract class for different lines in LDraw format (supported: 0,1,3,4. ignored: 2, 5 (lines))
BRIGL.BrickSpec = function ( ) {
	// constructor
};

BRIGL.BrickSpec.prototype = {
	constructor: BRIGL.BrickSpec,
};

// Class representing lines of type 0 (comments) some BFC format is supported
BRIGL.CommentSpec = function ( vals ) {
	// constructor
	this.vals = vals;
};
BRIGL.CommentSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.CommentSpec.prototype = {

	constructor: BRIGL.CommentSpec,
	isCertify: function()
	{
		return ( (this.vals.length>=2) && (this.vals[1] === "BFC") && (this.vals[2] === "CERTIFY") );
	},
	isCertifyCcw: function()
	{
		if ( (this.isCertify()) && (this.vals.length == 4))
		{
				return this.vals[3] === "CCW";
		}
		return true;		
	},
	isAnimated: function()
	{
		return ( (this.vals.length>=2) && (this.vals[1] === "SIMPLEANIM") && (this.vals[2] === "ANIMATED") );
	},
	animatedName: function()
	{
		return this.vals[3];
	},
	isInvertNext: function()
	{
		return ( (this.vals.length>=2) && (this.vals[1] === "BFC") && (this.vals[2] === "INVERTNEXT") );
	},
	isBfcCcw: function()
	{
		return ( (this.vals.length==3) && (this.vals[1] === "BFC") && (this.vals[2] === "CCW") );
	},
	isBfcCw: function()
	{
		return ( (this.vals.length==3) && (this.vals[1] === "BFC") && (this.vals[2] === "CW") );
	},
	isStep: function()
	{
		return ( (this.vals.length==2) && (this.vals[1] === "STEP") );
	},
	fillMesh: function (transform, currentColor, meshFiller)
	{
	}
};

// this represent a part, has a list of BrickSpec inside
BRIGL.PartSpec = function ( partName ) {
	// constructor
	this.partName = partName;
	this.lines = [];
	this.fullyLoaded = false; // if this part is completely loaded with all children or not
	this.waiters = []; // list of callbacks to be called when this part is ready.
	this.numSteps = 1; // number of steps encountered
};
BRIGL.PartSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.PartSpec.prototype = {

	constructor: BRIGL.PartSpec,
	addLine: function(brickSpec)
	{
			this.lines.push(brickSpec);
			if((brickSpec.isStep) && (brickSpec.isStep()))
			{
							this.numSteps++;
			}
	},
	fillMesh: function (transform, currentColor, meshFiller, stepLimit)
	{
			for (var i=0; i<this.lines.length; i++)
			{
					var spec = this.lines[i];
					if((spec.isStep) && (spec.isStep()))
					{
							stepLimit--;
							if(stepLimit==0) return;
					}
					spec.fillMesh(transform, currentColor, meshFiller);
			}
	},
	wakeWaiters: function()
	{
			this.fullyLoaded = true;
			for (var i=0; i<this.waiters.length; i++) 
			{
					this.waiters[i]();
			}
			delete this.waiters;
	},
	whenReady: function(callback)
	{
			// if we are already loaded, call callback immediately
			this.fullyLoaded ? callback() : this.waiters.push(callback);
	}
};

// This class represent lines of type 1, subparts
BRIGL.SubPartSpec = function ( vals, inverted, animated, animatedName ) {
	// constructor
	this.color = parseInt(vals[1]);
	this.inverted = inverted;
	this.animated = animated;
	this.animatedName = animatedName;
	this.subpartName = vals.slice(14).join(" ").toLowerCase(); // join laste elements after 14^, work only if user use single space delimiter..
	this.subpartSpec = undefined;
	this.matrix = new THREE.Matrix4(
	  parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]), parseFloat(vals[2]),
	  parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]), parseFloat(vals[3]),
		parseFloat(vals[11]), parseFloat(vals[12]), parseFloat(vals[13]), parseFloat(vals[4]),
		0.0, 0.0, 0.0, 1.0
	);
};
BRIGL.SubPartSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.SubPartSpec.prototype = {

	constructor: BRIGL.SubPartSpec,
	fillMesh: function (transform, currentColor, meshFiller)
	{
			if(this.inverted) meshFiller.inverting = !meshFiller.inverting; 
			
			var nt = new THREE.Matrix4();
			nt.multiply(transform, this.matrix);
			var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
			
			if(this.animated)
			{
				var subPartPos = nt.getPosition();
				var subPartPosNegated = subPartPos.clone().negate();
				// create a subfiller and a Mesh for this branch
				var subFiller = new BRIGL.MeshFiller();
				var opt2 = xclone(meshFiller.options); // use same options...
				opt2.dontCenter = true; // ...except don't center
				//opt2.startingMatrix = nt.clone(); // ...and use this part matrix as starting matrix for transform
				var subMesh = subFiller.partToMesh(this.subpartSpec, opt2); // create submesh
				subMesh.applyMatrix(this.matrix);
				// since i'm using quats, i have to bring rotation separately
				subMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(this.matrix));
				//subMesh.updateMatrix();
				meshFiller.animatedMesh[this.animatedName] = subMesh; // add submesh to parent filler
				// also add all submesh animatedMesh (so the first one has all the mappings)
				Object.keys( subFiller.animatedMesh ).map(function( key ) {
					meshFiller.animatedMesh[key] = subFiller.animatedMesh[key];
   			});
				
			}
			else
			{
				this.subpartSpec.fillMesh(nt, c, meshFiller);
			}
			
			if(this.inverted) meshFiller.inverting = !meshFiller.inverting; 
	}
};

// This class represent lines of type 2, lines
BRIGL.LineSpec = function ( vals ) {
	// constructor
	this.color = parseInt(vals[1]);
	this.one = new THREE.Vector3( parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]) );
	this.two = new THREE.Vector3( parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]) );
};
BRIGL.LineSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.LineSpec.prototype.constructor = BRIGL.LineSpec;
BRIGL.LineSpec.prototype.fillMesh = function (transform, currentColor, meshFiller)
	{
			if(!meshFiller.wantsLines) return; // not interested
			var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
			meshFiller.addLine(transform.multiplyVector3(this.one.clone()),transform.multiplyVector3(this.two.clone()), c);
	};
	
// This class represent lines of type 5, conditional lines
BRIGL.CondLineSpec = function ( vals ) {
	// constructor
	this.color = parseInt(vals[1]);
	this.one = new THREE.Vector3( parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]) );
	this.two = new THREE.Vector3( parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]) );
};
BRIGL.CondLineSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.CondLineSpec.prototype.constructor = BRIGL.CondLineSpec;
BRIGL.CondLineSpec.prototype.fillMesh = function (transform, currentColor, meshFiller)
	{
		  var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
			meshFiller.addCondLine(transform.multiplyVector3(this.one.clone()),transform.multiplyVector3(this.two.clone()));
	};

// This class represent lines of type 3, triangles
BRIGL.TriangleSpec = function ( vals, ccw, certified ) {
	// constructor
	this.ccw = ccw;
	this.certified = certified;
	this.color = parseInt(vals[1]);
	this.one = new THREE.Vector3( parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]) );
	this.two = new THREE.Vector3( parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]) );
	this.three = new THREE.Vector3( parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]) );
};
BRIGL.TriangleSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.TriangleSpec.prototype.constructor = BRIGL.TriangleSpec;
BRIGL.TriangleSpec.prototype.fillMesh = function (transform, currentColor, meshFiller)
	{
		
			var det = transform.determinant(); // this is equal for all tri and quad in PartSpec, could be calculated before
			var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
			meshFiller.addFace(this.ccw, this.certified, det, c, 
					transform.multiplyVector3(this.one.clone()),
					transform.multiplyVector3(this.two.clone()),
					transform.multiplyVector3(this.three.clone()));
	};

// This class represent lines of type 4, quads
BRIGL.QuadSpec = function ( vals, ccw, certified ) {
	// constructor
	this.ccw = ccw;
	this.certified = certified;
	this.color = parseInt(vals[1]);
	this.one = new THREE.Vector3( parseFloat(vals[2]), parseFloat(vals[3]), parseFloat(vals[4]) );
	this.two = new THREE.Vector3( parseFloat(vals[5]), parseFloat(vals[6]), parseFloat(vals[7]) );
	this.three = new THREE.Vector3( parseFloat(vals[8]), parseFloat(vals[9]), parseFloat(vals[10]) );
	this.four = new THREE.Vector3( parseFloat(vals[11]), parseFloat(vals[12]), parseFloat(vals[13]) );
};
BRIGL.QuadSpec.prototype = Object.create( BRIGL.BrickSpec.prototype );
BRIGL.QuadSpec.prototype.constructor= BRIGL.QuadSpec;
BRIGL.QuadSpec.prototype.fillMesh= function (transform, currentColor, meshFiller)
	{
			//BRIGL.log("fillMesh for quad");
			var det = transform.determinant();
			var c = ((this.color == 16) || (this.color == 24)) ? currentColor : this.color;
			meshFiller.addFace(this.ccw, this.certified, det, c ,
				transform.multiplyVector3(this.one.clone()),
				transform.multiplyVector3(this.two.clone()),
				transform.multiplyVector3(this.three.clone()),
				transform.multiplyVector3(this.four.clone())
			);
	}

BRIGL.Builder = function (partsUrl, options ) {
	// constructor
	if(!options) options = {};
	this.partCache = {};
	this.partRequests = {};
	this.partsUrl = partsUrl;
	this.asyncnum = 0;
	if (options.dontUseSubfolders) this.dontUseSubfolders = options.dontUseSubfolders; 
};

BRIGL.Builder.prototype = {

	constructor: BRIGL.Builder,

  cleanCache: function()
  {
  		this.partCache = {};
  },

	cacheCount: function ()
	{
			return Object.keys(this.partCache).length;
	},

	asyncReq: function(partName, callback)
	{
		var purl;
		if(this.dontUseSubfolders) {
		    purl = this.partsUrl+partName;
		} else {
			purl = this.partsUrl+partName.charAt(0)+"/"+partName; // replicate first char to subdivide in more folders
		}
		var purl = purl.replace(/\\/gi,"/");
		this.asyncnum++;
		new Ajax.Request(purl, {
			method:'get',
			//onCreate: function(arg) {arguments[0].request.transport.overrideMimeType('text\/plain; charset=x-user-defined') }, // force to download unprocessed, useful for eventual binary parts.
			
		  onSuccess: (function(transport) {
				var res = transport.responseText;
				this.asyncnum--;
				
				callback(res);
		  }).bind(this),
		  onFailure: (function() { this.asyncnum--; alert( 'Something went wrong loading: '+partName); }).bind(this)
		});
	},

  // Loads a model from the part server and return the Mesh
	loadModelByName: function (partName, options, callback) {
		BRIGL.log("Creating "+partName+"...");
		if(!options) options = {};
		var partSpec = this.getPart(partName);
		partSpec.whenReady((function()
		{
			//this.buildAndReturnMesh(partSpec, callback, options.drawLines?options.drawLines:false, options.stepLimit ? options.stepLimit : -1);
			BRIGL.log("Generating geometry");
			var meshFiller = new BRIGL.MeshFiller();
			var mesh = meshFiller.partToMesh(partSpec, options);

			BRIGL.log("Model loaded successfully");
			callback(mesh);
			
		}).bind(this)
		);
	},
	
	// Loads a model from the data provided and return the Mesh
	loadModelByData: function (partName, partData, options, callback) {

		BRIGL.log("Parsing "+partName+"...");
		var partSpec = new BRIGL.PartSpec(partName);
		this.partCache[partSpec.partName] = partSpec;
		this.parsePart(partSpec, partData);
		
		partSpec.whenReady((function()
		{
				this.loadModelByName(partName, options, callback);
		}).bind(this)
		);
	},
	

	
	parsePart: function(partSpec, partData)
	{
		// parses some text and fill the PartSpec in input
		var lines = partData.split("\n");
		if (this.isMultipart(lines))
		{
				this.parseMultiPart(partSpec, lines);
		}
		else
		{
				this.parseSinglePart(partSpec, lines);
		}	
	},
	
	parseSinglePart: function(partSpec, lines)
	{
		// parses some text and build a PartSpec fully populated with BrickSpec children
				
		var inverted = false; 	// next should be inverted?
		var animated = false;		// next should be animated?
		var animatedName = undefined; //valid only if animated
		var ccw = true;					// dealing with ccw or cw ?
		var certified = false;  // certified BFC ?
		
		for (var i=0; i<lines.length; i++)
		{
				var li = lines[i].trim();
				if(li==='') continue;
				
				var tokens = li.split(/[ \t]+/);
				if(tokens[0] === '0') 
				{
					var cs = new BRIGL.CommentSpec(tokens);
					partSpec.addLine(cs);
					if (cs.isInvertNext()) {
						inverted = true;
					} 
					else if (cs.isCertify()) {
						certified = true;
						ccw = cs.isCertifyCcw();
					} 
					else if(cs.isBfcCcw())
					{
							ccw = true;
					} 
					else if(cs.isAnimated())
					{
							animated = true;
							animatedName = cs.animatedName();
					} 
					else if(cs.isBfcCw())
					{
							ccw = false;
					}
				}
				else if(tokens[0] === '1') 
				{
					partSpec.addLine(new BRIGL.SubPartSpec(tokens, inverted, animated, animatedName));
					inverted = false;
					animated = false;
					animatedName = undefined;
				}
				else if(tokens[0] === '2') 
				{
					partSpec.addLine(new BRIGL.LineSpec(tokens));
				}
				else if(tokens[0] === '3') 
				{
					partSpec.addLine(new BRIGL.TriangleSpec(tokens, ccw, certified));
				}
				else if(tokens[0] === '4') 
				{
					partSpec.addLine(new BRIGL.QuadSpec(tokens, ccw, certified));
				}
				else if(tokens[0] === '5') 
				{
					partSpec.addLine(new BRIGL.CondLineSpec(tokens));
				}				
		}
		this.populateSubparts(partSpec);
	},
	
	parseMultiPart: function(part, lines)
	{
		// parses some text and build a PartSpec fully populated with BrickSpec children
		BRIGL.log("Parsing multipart "+part.partName);
		
		var currentName = "";
		var stuff = []; 
		var currentStuff = null;
		
		// first we parse all part block into a buffer..
		for (var i=0; i<lines.length; i++)
		{
				var li = lines[i].trim();
				if(li==='') continue;
				
				if(li.startsWith("0 FILE ")) 
				{
						if(currentStuff)
						{
								// handle it
								stuff.push(currentStuff);
						}
						var subname = li.substring(7);
						BRIGL.log("Found subpart "+subname);
						currentStuff = { partName: subname, lines: [] };
				}
				else
				{
					if (currentStuff) currentStuff.lines.push(li);
				}
		}
		if(currentStuff)
		{
				// handle it
				stuff.push(currentStuff);
		}
		BRIGL.log("Total subparts: "+stuff.length);
		
		// scroll backward becouse first parts depend on last parts
		for (var i=stuff.length-1; i>=0; i--)
		{
				var last = stuff[i];
				var partSpec;
				if(i == 0) 
				{
							// as this is the first and main part, use partSpec received in input
							partSpec = part;
				}
				else
				{
							// this is a subpart so create a new partSpec
							partSpec = new BRIGL.PartSpec(last.partName.toLowerCase());
							this.partCache[partSpec.partName] = partSpec;
				}
				this.parseSinglePart(partSpec, last.lines);
		}
	},
		
	// tests if an array of lines is a multipart
	isMultipart: function(lines)
	{
		for (var i=0; i<lines.length; i++)
		{
				var li = lines[i].trim();
				if(li==='') continue;
				
				if(li.startsWith("0 FILE "))
				{
						return true;
				}
				else if( li.startsWith("1") || li.startsWith("2") || li.startsWith("3")||li.startsWith("4")||li.startsWith("5") )
				{
						// as per specifications, any command before a 0 FILE means no multipart
						return false;
				}
		}
		return false;
	},
	
	getPart: function(partName)
	{
			// obtain a PartSpec, either from local cache or from server
			var p = this.partCache[partName];
			if(p)
			{
					return p;
			}
			else
			{
					var p = new BRIGL.PartSpec(partName);
					this.partCache[partName] = p;
					
					// the part is not being downloaded, we'll start it!
					BRIGL.log("Loading "+partName);
					this.asyncReq(partName, (function(txt)
					{
							// when async return, parse part
							this.parsePart(p, txt);
					}).bind(this))
					
					return p;
			}
	},
	
	populateSubparts: function(partSpec)
	{
			// takes a PartSpec and scan for all SubpartSpec (type 1)
			// for each one it loads the correct PartSpec (we loaded only the name before)
			var toLoad = [];
			for (var i=0; i<partSpec.lines.length; i++)
			{
					var spec = partSpec.lines[i];
					if(spec instanceof BRIGL.SubPartSpec)
					{
							if(spec.subpartSpec === undefined)
							{
								toLoad.push( spec );
							}
					}
			}			
			// now toLoad contains all the subpart that need loading.
			var count = toLoad.length;	
			if(count == 0)
			{
				// no subpart to load, we are ready!
				partSpec.wakeWaiters();
			}
			else
			{
				  for (var i=0; i<toLoad.length; i++)
					{
						  var spec = toLoad[i];
							var subSpec = this.getPart(spec.subpartName);
							spec.subpartSpec = subSpec;
							
							// all subpart must be ready before we call the callback
							subSpec.whenReady(function(){
									count--; // decrease total amount of parts we are waiting for
									if(count==0)
									{
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
BRIGL.BriglContainer = function ( container, model) {
	// constructor
	this.scene = 0;
	this.camera = 0;
	this.renderer = 0;
	this.container = container;
	this.mouseDown = 0;
	this.lastMouseX = null;
	this.lastMouseY = null;
	
	this.setup();
	this.setModel(model, true);
	this.render();
	
};

BRIGL.BriglContainer.prototype = {

	constructor: BRIGL.BriglContainer,
	
  degToRad: function(degrees) {
        return degrees * Math.PI / 180;
    },
	setModel: function(newmesh, resetView)
	{
		var oldMesh = this.mesh;
		this.mesh = newmesh;
		newmesh.useQuaternion = true;
		if(resetView)
		{			
			newmesh.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,-0.5).normalize(), 3.34);
			newmesh.geometry.computeBoundingSphere();
		  // place the camera at a right distance to gracefully fill the area
		  var radiusDelta = newmesh.geometry.boundingSphere.radius / 180.0; // empirical
		  this.camera.position.set(0*radiusDelta,150*radiusDelta,400*radiusDelta);
			this.camera.lookAt(this.scene.position);	
		}
		else
		{
				if(oldMesh) 
				{
					newmesh.position.copy(oldMesh.position);
					newmesh.quaternion.copy(oldMesh.quaternion);
				}
		}
	  this.scene.add(this.mesh);
	  if(oldMesh) this.scene.remove(oldMesh);
	  
		this.render();
	},
	

	handleMouseDown: function(event) {
		
		event.preventDefault();
		event.stopPropagation();
		
		this.mouseDown = event.button+1;
		this.lastMouseX = event.clientX;
		this.lastMouseY = event.clientY;
	},

	handleMouseUp: function(event) {
		event.preventDefault();
		event.stopPropagation();
		this.mouseDown = 0;
	},
  handleMouseWheel: function(event){
  	event.preventDefault();
		event.stopPropagation();
		var delta = event.wheelDelta ?  event.wheelDelta  : (event.detail ? -event.detail  : 0);
		var mu = (delta<0 ? 1.1 : delta >0 ? 0.9 : 1);
		this.camera.position.multiplyScalar(mu);
		
		this.render();
  },
  
	handleMouseMove: function(event) {
		if (this.mouseDown==0) {
		  return;
		}
		event.preventDefault();
		event.stopPropagation();
		var newX = event.clientX;
		var newY = event.clientY;

		var deltaX = newX - this.lastMouseX;
		var deltaY = newY - this.lastMouseY;
		
		if(this.mouseDown == 1)
		{
			// rotation
			var q2 = new THREE.Quaternion();
			q2.setFromAxisAngle(new THREE.Vector3(1,0,0), this.degToRad(deltaY / 5));
			var q = new THREE.Quaternion();
			q.setFromAxisAngle(new THREE.Vector3(0,1,0), this.degToRad(deltaX / 5));
			
			this.mesh.quaternion.multiply(q, this.mesh.quaternion);
			this.mesh.quaternion.multiply(q2, this.mesh.quaternion);
			this.mesh.updateMatrix();	
		}
		else if (this.mouseDown == 2	)
		{
			// pan
			this.mesh.position.addSelf(new THREE.Vector3(deltaX/5.0, -deltaY/5.0));
			this.mesh.updateMatrix();	
		}
		
		this.lastMouseX = newX
		this.lastMouseY = newY;
		
		this.render();
	  },
	
	setup: function()
	{
			// SCENE
			this.scene = new THREE.Scene();
			// CAMERA
			var SCREEN_WIDTH = this.container.getWidth(), SCREEN_HEIGHT = this.container.getHeight();
			var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
			this.camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
			this.scene.add(this.camera);
			this.camera.position.set(0,150,400);
			this.camera.lookAt(this.scene.position);	
			// RENDERER
			this.renderer = new THREE.WebGLRenderer( {antialias:true} );
			this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			this.container.appendChild( this.renderer.domElement );
		
			// LIGHT (lighting could be choosen better)
			var light = new THREE.PointLight(0xffffff);
			light.position.set(0,250,0);
			this.scene.add(light);
			
			var light = new THREE.DirectionalLight(0xaaaaaa);
			light.position.set(0,00,100);
			this.scene.add(light);
			
			//events
			this.container.addEventListener( 'mousedown', (function(event) { this.handleMouseDown(event); }).bind(this), false );
			this.container.addEventListener( 'mouseup', (function(event) { this.handleMouseUp(event); }).bind(this), false );
			this.container.addEventListener( 'mousemove', (function(event) { this.handleMouseMove(event); }).bind(this), false );
			this.container.addEventListener( 'mousewheel', (function(event) { this.handleMouseWheel(event); }).bind(this), false );
			this.container.addEventListener( 'DOMMouseScroll', (function(event) { this.handleMouseWheel(event); }).bind(this), false ); // firefox

	},
	
	render: function()
	{
		this.renderer.render( this.scene, this.camera );
	}
};
