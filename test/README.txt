
An automated testing framework for BRIGL.

1. Configuration:

If this is your BRIGL web-server directory:
/var/www/html/brigl

Then copy this folder as a sub-directory:
/var/www/html/brigl/test

On a linux computer you can do this using the install.sh script
in BRIGL's root directory.

$ cd path/to/brigl
$ sh install.sh


2. Testing:

To run the tests you need Selenium, Python, the Python bindings for Selenium
and a web driver. I used the Chrome version, 'chromedriver'. Put a copy of
'chromedriver' in the test directory of the BRIGL project and the run the tests
using pytest.

$ cd path/to/brigl/test
$ cp path/to/chromedriver .
$ pytest
