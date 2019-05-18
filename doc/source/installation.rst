Installation
============

The software can only run if it is hosted on a web server. It will not
run opening the html files on the browser. This is because part files
are downloaded asynchronously from the server.

Download Parts
--------------

1. Download the official LDraw library.

   If you don't already have it, download the official LDraw part library
   from `here <http://www.ldraw.org/library/updates/complete.zip>`_.

2. (Optional) Download the unofficial parts library.

   The unofficial parts library is `here <http://www.ldraw.org/library/unofficial/ldrawunf.zip>`_.

Prepare Parts
-------------

In the instructions below ``/var/www/html/brigl/`` is the folder on the
web server where BRIGL will be installed. Adjust as needed.


Simplest Installation
~~~~~~~~~~~~~~~~~~~~~

1. Unzip the official parts library and copy it to a sub-directory called ``ldraw``. ::

   $ cd ldraw_dir
   $ unzip complete.zip
   $ cd /var/www/html/brigl/
   $ mkdir ldraw
   $ cp -r /path/to/ldraw_dir/parts ./ldraw/.
   $ cp -r /path/to/ldraw_dir/p ./ldraw/.
  
2. Copy the web folder from brigl. ::

   $ cd /var/www/html/brigl/
   $ cp -r /path/to/brigl/web/* .

3. Copy a model to the models directory. ::

   $ cd /var/www/html/brigl/
   $ mkdir models
   $ cp /path/to/brigl/web/parts/m/modelViper.ldr ./models/.
   
4. Start your browser and load this url.

   http://127.0.0.1/brigl/simple_install.html

.. note:: The standard BRIGL examples will not work with this installation as they
	  expect a different directory structure, see next section.
   
Advanced Installation
~~~~~~~~~~~~~~~~~~~~~

A simple installation could be less efficient because the client will often have to query
the server multiple times in order to determine which folder a part is located in. To
improve performance it is recommended that all of the parts are in a single folder.
In this installation all of the parts are in a folder called ``parts``.

1. Unzip the official parts library. ::
     
   $ cd ldraw_dir
   $ unzip complete.zip

2. Copy the web folder from brigl. ::

   $ cd /var/www/html/brigl/
   $ cp -r /path/to/brigl/web/* .
  
3. Prepare parts using the prepareParts.py Python script. ::

   $ cd /var/www/html/brigl
   $ mkdir parts
   $ python /path/to/brigl/tools/prepareParts.py path/to/ldraw_dir/parts ./parts
   $ python /path/to/brigl/tools/prepareParts.py path/to/ldraw_dir/p ./parts

4. Start your browser and load this url.

   http://127.0.0.1/brigl/index.html

.. note:: prepareParts.py will also create sub-directories in parts that use the first
	  letter of the part name as the directory name, for example a.dat -> a/a.dat.


Customizing Colors
------------------

BRIGL uses the colors specified in the ``web/js/brigl_materials.js``. This file was
generated from a ``LDConfig.ldr`` file using ``tools/ld_config_to_brigl_materials.py``. You
can use this Python script yourself if you have customized ``LDConfig.ldr``. ::

  $ cd brigl/tools
  $ python ld_config_to_brigl_materials.py --ldconfig path/to/LDConfig.ldr
  $ cp brigl_materials.js path/to/web-server/brigl/js/.

  
