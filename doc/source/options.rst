Options
=======

BRIGL.Builder
-------------

Options are used like this. ::

  var builder = new BRIGL.Builder("parts/", {ajaxMethod:"jquery"});

* ``forceLowercase`` : Forces partname to lowercase when downloading them from the server. Useful if you have inconsistencies in part name case. Default is false.
* ``dontUseSubfolders`` : Use ``true`` if you performed a simple installation and your parts directory structure is the same as the LDraw standard. Use ``false`` if you performed the advanced installation and your parts directory structure has been optimized for BRIGL.
* ``ajaxMethod`` : Choose which library to use for ajax calls. Valid values are "jquery" and "prototype". Defaults is "prototype".

loadModelBy..
~~~~~~~~~~~~~

These options apply to the ``loadModelByName()``, ``loadModelByData()`` and ``loadModelByUrl()`` methods.

* ``drawLines`` : Draw edge lines. Default is false.
* ``stepLimit`` : Read a model only up to stepLimit number of steps. Useful to show partial build. Defaults -1 (no limit).
* ``dontCenter`` : Don't calculate center of object, use model origin instead. Default is false.
* ``centerOffset`` : Use this vector as the center offset (the displacement of the model). Default is undefined.
* ``dontSmooth`` : Avoid smoothing process. Default is false.
* ``blackLines`` : Draw all edge lines in black instead of their color. Default is false.
* ``startColor`` : Use value as starting color. Default is 16.
* ``startingMatrix`` : Use value as the starting transformation matrix. Default is undefined. Options are a ``THREE.Matrix4()`` matrix, an array in LDraw transform format ``[x, y, z, a, b, c, d, e, f, g, h, i]`` or a string in LDraw transform format ``"x y z a b c d e f g h i"``.

BRIGL.BriglContainer
--------------------

* ``antialias`` : Use antialiasing. Default is ``true``.
* ``backgroundColor`` : The container background color. Default is ``0xffffff``.
* ``directionalLightColor`` : The color for the directional lighting source. Default is ``0xaaaaaa``.
* ``latlon`` : Use latidude / longitude rotation. Default is ``false``.
* ``pointLightColor`` : The color for the point lighting source. Default is ``0xffffff``.

And all the options supported `three.js <https://threejs.org/docs/#api/renderers/WebGLRenderer>`_.

Also
----

* BRIGL will not resize the container element that is used for rendering, so the desired size must be specified in advance.
* Currently BRIGL does not handle re-size events.
