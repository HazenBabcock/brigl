
## Brigl, a WebGL renderer for LDraw models ##

Brigl is a javascript program that read and parses LDraw models, and renders 
them with WebGL.

Note: The original git conversion without any further modifications is
available in the "original" branch.

[![Documentation Status](https://readthedocs.org/projects/brigl/badge/?version=latest)](https://brigl.readthedocs.io/)


## Online demos ##

This version in [action](https://hazenbabcock.github.io/brigl/index.html).

The original in [action](http://www.lugato.net/brigl/index.html).


## How it works ##

Brigl is 100% pure javascript, with no server logic. The only thing stored
on the server is the parts library, a set of small files with the 3d
model of each piece. Any static server can be used, no need for php or other
features!

When you ask Brigl to render an LDraw model, it fetches all needed parts and
subparts from the server, and assemble the model in your browser memory.
It then starts a WebGL context and renders your model!


### Features ###

* Load any user submitted model
* Parses standard, unprocessed LDraw format
* Multipart support
* Display line edges (only nonconditional)
* Smooth shading of curved surfaces
* Support building steps
* Zoom, Rotate and Pan view
* Multiple view per page


## How to use ##

The documentation is [here](https://brigl.readthedocs.io/en/latest/).


